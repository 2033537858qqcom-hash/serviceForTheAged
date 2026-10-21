package com.agedcare.security;

import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.UserContext;
import com.agedcare.modules.dispatch.entity.DispatchAttempt;
import com.agedcare.modules.dispatch.mapper.DispatchAttemptMapper;
import com.agedcare.modules.elder.entity.ElderProfile;
import com.agedcare.modules.elder.mapper.ElderProfileMapper;
import com.agedcare.modules.elder.service.ElderProfileService;
import com.agedcare.modules.family.dto.ElderSearchVO;
import com.agedcare.modules.family.entity.FamilyBinding;
import com.agedcare.modules.family.mapper.FamilyBindingMapper;
import com.agedcare.modules.family.service.FamilyBindingService;
import com.agedcare.modules.fulfillment.entity.ServiceComplaint;
import com.agedcare.modules.fulfillment.entity.ServiceReview;
import com.agedcare.modules.fulfillment.mapper.ServiceComplaintMapper;
import com.agedcare.modules.fulfillment.mapper.ServiceRecordMapper;
import com.agedcare.modules.fulfillment.mapper.ServiceReviewMapper;
import com.agedcare.modules.fulfillment.service.FulfillmentService;
import com.agedcare.modules.order.dto.OrderCreateDTO;
import com.agedcare.modules.order.entity.ServiceOrder;
import com.agedcare.modules.order.mapper.OrderStatusLogMapper;
import com.agedcare.modules.order.mapper.ServiceOrderMapper;
import com.agedcare.modules.order.service.OrderService;
import com.agedcare.modules.serviceitem.mapper.ServiceItemMapper;
import com.agedcare.modules.staff.entity.StaffProfile;
import com.agedcare.modules.staff.mapper.StaffProfileMapper;
import com.agedcare.modules.user.mapper.SysUserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RolePermissionSecurityTest {

    @Mock private ElderProfileMapper elderProfileMapper;
    @Mock private FamilyBindingMapper familyBindingMapper;
    @Mock private SysUserMapper sysUserMapper;
    @InjectMocks private FamilyBindingService familyBindingService;

    @Mock private ServiceOrderMapper serviceOrderMapper;
    @Mock private OrderStatusLogMapper orderStatusLogMapper;
    @Mock private ServiceItemMapper serviceItemMapper;
    @Mock private StaffProfileMapper staffProfileMapper;
    @Mock private DispatchAttemptMapper dispatchAttemptMapper;
    @Mock private ElderProfileService elderProfileService;
    @InjectMocks private OrderService orderService;

    @Mock private ServiceRecordMapper serviceRecordMapper;
    @Mock private ServiceReviewMapper serviceReviewMapper;
    @Mock private ServiceComplaintMapper serviceComplaintMapper;
    @InjectMocks private FulfillmentService fulfillmentService;

    @InjectMocks private ElderProfileService realElderProfileService;

    @AfterEach
    public void tearDown() {
        UserContext.clear();
    }

    @Test
    @DisplayName("P6隐私防护: 按手机号检索老人仅返回脱敏核验VO，屏蔽身份证、住址和经纬度等全量档案")
    public void testSearchElderByPhoneMasking() {
        ElderProfile elder = ElderProfile.builder()
                .id(101L)
                .name("张三丰")
                .phone("13812345678")
                .idCard("110101194001011234")
                .community("幸福里社区")
                .address("幸福里社区1栋101室")
                .status(1)
                .build();
        when(elderProfileMapper.selectOne(any())).thenReturn(elder);

        ElderSearchVO result = familyBindingService.searchElderByPhone("13812345678");

        assertNotNull(result);
        assertEquals(101L, result.getId());
        assertEquals("张*丰", result.getName());
        assertEquals("138****5678", result.getPhone());
        assertEquals("幸福里社区", result.getCommunity());
        assertTrue(result.getExists());
    }

    @Test
    @DisplayName("P3职责隔离: 服务人员(STAFF)禁止代客下单预约")
    public void testStaffCannotCreateOrder() {
        UserContext.setUser(LoginUser.builder().id(2L).role(UserRole.STAFF.getCode()).build());

        OrderCreateDTO dto = new OrderCreateDTO();
        dto.setElderId(101L);

        BusinessException ex = assertThrows(BusinessException.class, () -> orderService.createOrder(dto));
        assertEquals(403, ex.getCode());
        assertTrue(ex.getMessage().contains("服务人员无权作为发起人代客下单"));
    }

    @Test
    @DisplayName("P3职责隔离: 服务人员(STAFF)禁止新建或修改老人档案")
    public void testStaffCannotSaveElderProfile() {
        UserContext.setUser(LoginUser.builder().id(2L).role(UserRole.STAFF.getCode()).build());

        ElderProfile profile = ElderProfile.builder().name("李大爷").phone("13900000000").build();

        BusinessException ex = assertThrows(BusinessException.class, () -> realElderProfileService.saveOrUpdate(profile));
        assertEquals(403, ex.getCode());
        assertTrue(ex.getMessage().contains("服务人员无权新建或修改老人档案"));
    }

    @Test
    @DisplayName("P1审核闭环: 居民自主新建第二位老人档案时，关系绑定进入待审核(PENDING)状态，杜绝免审绕过漏洞")
    public void testResidentSecondElderProfileRequiresAudit() {
        UserContext.setUser(LoginUser.builder().id(88L).role(UserRole.RESIDENT.getCode()).build());

        // 已存在本人的档案
        when(elderProfileMapper.selectCount(any())).thenReturn(1L);

        ElderProfile secondElder = ElderProfile.builder().name("王奶奶").phone("13899998888").build();
        realElderProfileService.saveOrUpdate(secondElder);

        verify(elderProfileMapper).insert(secondElder);

        // 验证插入的 FamilyBinding 为 PENDING 状态，等待管理员审核
        verify(familyBindingMapper).insert((FamilyBinding) argThat(b -> {
            FamilyBinding binding = (FamilyBinding) b;
            return binding != null
                    && Long.valueOf(88L).equals(binding.getFamilyUserId())
                    && "PENDING".equals(binding.getStatus())
                    && binding.getReviewerId() == null;
        }));
    }

    @Test
    @DisplayName("P8学术纯净性: 管理员(ADMIN)禁止代客提交服务评价，防止污染Q质量打分指标")
    public void testAdminCannotSubmitReview() {
        UserContext.setUser(LoginUser.builder().id(1L).role(UserRole.ADMIN.getCode()).build());

        ServiceOrder order = ServiceOrder.builder()
                .id(501L)
                .requesterUserId(10L)
                .status("COMPLETED")
                .build();
        when(serviceOrderMapper.selectById(501L)).thenReturn(order);

        ServiceReview review = ServiceReview.builder().orderId(501L).rating(5).build();

        BusinessException ex = assertThrows(BusinessException.class, () -> fulfillmentService.submitReview(review));
        assertEquals(403, ex.getCode());
        assertTrue(ex.getMessage().contains("管理员不得代用户评价"));
    }

    @Test
    @DisplayName("P7权限闭环: 提交投诉必须绑定合法订单归属")
    public void testSubmitComplaintRequiresOwnership() {
        UserContext.setUser(LoginUser.builder().id(99L).role(UserRole.RESIDENT.getCode()).build());

        // 订单不存在情况
        ServiceComplaint notFoundComplaint = ServiceComplaint.builder().orderId(999L).build();
        when(serviceOrderMapper.selectById(999L)).thenReturn(null);
        BusinessException exNotFound = assertThrows(BusinessException.class, () -> fulfillmentService.submitComplaint(notFoundComplaint));
        assertTrue(exNotFound.getMessage().contains("目标订单不存在"));

        // 订单非当前用户下单且未获老人授权
        ServiceOrder foreignOrder = ServiceOrder.builder()
                .id(888L)
                .requesterUserId(10L)
                .elderId(200L)
                .build();
        when(serviceOrderMapper.selectById(888L)).thenReturn(foreignOrder);
        when(elderProfileMapper.selectById(200L)).thenReturn(ElderProfile.builder().id(200L).build());
        doThrow(new BusinessException(403, "您未获得该老人的委托授权")).when(elderProfileService).checkAccessPermission(any());

        ServiceComplaint foreignComplaint = ServiceComplaint.builder().orderId(888L).build();
        BusinessException exUnauthorized = assertThrows(BusinessException.class, () -> fulfillmentService.submitComplaint(foreignComplaint));
        assertEquals(403, exUnauthorized.getCode());
    }

    @Test
    @DisplayName("P8履约安全: 非当前指派的服务人员禁止开始服务")
    public void testNonAssignedStaffCannotStartService() {
        UserContext.setUser(LoginUser.builder().id(2L).role(UserRole.STAFF.getCode()).build());

        ServiceOrder order = ServiceOrder.builder()
                .id(601L)
                .status("WAIT_VISIT")
                .currentDispatchId(701L)
                .build();
        when(serviceOrderMapper.selectByIdForUpdate(601L)).thenReturn(order);

        // 指派的是 402 号师傅
        DispatchAttempt attempt = DispatchAttempt.builder().id(701L).staffId(402L).build();
        when(dispatchAttemptMapper.selectById(701L)).thenReturn(attempt);

        // 当前登录的是 401 号师傅
        StaffProfile staff401 = StaffProfile.builder().id(401L).userId(2L).build();
        when(staffProfileMapper.selectOne(any())).thenReturn(staff401);

        BusinessException ex = assertThrows(BusinessException.class, () -> fulfillmentService.startService(601L));
        assertEquals(403, ex.getCode());
        assertTrue(ex.getMessage().contains("只有当前接单的服务人员才能开始服务"));
    }
}
