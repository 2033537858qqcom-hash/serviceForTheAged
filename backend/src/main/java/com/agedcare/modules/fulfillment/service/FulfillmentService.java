package com.agedcare.modules.fulfillment.service;

import com.agedcare.common.api.ResultCode;
import com.agedcare.common.enums.BookingStatus;
import com.agedcare.common.enums.OrderStatus;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.UserContext;
import com.agedcare.modules.dispatch.entity.DispatchAttempt;
import com.agedcare.modules.dispatch.entity.StaffBooking;
import com.agedcare.modules.dispatch.mapper.DispatchAttemptMapper;
import com.agedcare.modules.dispatch.mapper.StaffBookingMapper;
import com.agedcare.modules.elder.entity.ElderProfile;
import com.agedcare.modules.elder.mapper.ElderProfileMapper;
import com.agedcare.modules.elder.service.ElderProfileService;
import com.agedcare.modules.fulfillment.entity.ServiceComplaint;
import com.agedcare.modules.fulfillment.entity.ServiceRecord;
import com.agedcare.modules.fulfillment.entity.ServiceReview;
import com.agedcare.modules.fulfillment.mapper.ServiceComplaintMapper;
import com.agedcare.modules.fulfillment.mapper.ServiceRecordMapper;
import com.agedcare.modules.fulfillment.mapper.ServiceReviewMapper;
import com.agedcare.modules.order.entity.OrderStatusLog;
import com.agedcare.modules.order.entity.ServiceOrder;
import com.agedcare.modules.order.mapper.OrderStatusLogMapper;
import com.agedcare.modules.order.mapper.ServiceOrderMapper;
import com.agedcare.modules.staff.entity.StaffProfile;
import com.agedcare.modules.staff.mapper.StaffProfileMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FulfillmentService {

    private final ServiceOrderMapper serviceOrderMapper;
    private final OrderStatusLogMapper orderStatusLogMapper;
    private final DispatchAttemptMapper dispatchAttemptMapper;
    private final StaffBookingMapper staffBookingMapper;
    private final StaffProfileMapper staffProfileMapper;
    private final ElderProfileMapper elderProfileMapper;
    private final ElderProfileService elderProfileService;
    private final ServiceRecordMapper serviceRecordMapper;
    private final ServiceReviewMapper serviceReviewMapper;
    private final ServiceComplaintMapper serviceComplaintMapper;

    /**
     * 服务人员开始上门服务
     */
    @Transactional(rollbackFor = Exception.class)
    public void startService(Long orderId) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        ServiceOrder order = serviceOrderMapper.selectByIdForUpdate(orderId);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }

        if (!OrderStatus.WAIT_VISIT.getCode().equals(order.getStatus())) {
            throw new BusinessException("订单当前状态不可开始服务: " + order.getStatus());
        }

        if (order.getCurrentDispatchId() == null) {
            throw new BusinessException("订单无有效派单记录，无法开始服务");
        }

        DispatchAttempt attempt = dispatchAttemptMapper.selectById(order.getCurrentDispatchId());
        if (attempt == null) {
            throw new BusinessException("未找到订单对应派单信息");
        }

        // 权限校验：仅允许当前被指派的服务人员开始服务
        StaffProfile staff = staffProfileMapper.selectOne(new LambdaQueryWrapper<StaffProfile>()
                .eq(StaffProfile::getUserId, currentUser.getId()));
        if (staff == null || !staff.getId().equals(attempt.getStaffId())) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "只有当前接单的服务人员才能开始服务");
        }

        order.setStatus(OrderStatus.IN_SERVICE.getCode());
        order.setUpdatedAt(LocalDateTime.now());
        serviceOrderMapper.updateById(order);

        // 记录实际开始服务时间
        ServiceRecord existingRecord = serviceRecordMapper.selectOne(new LambdaQueryWrapper<ServiceRecord>()
                .eq(ServiceRecord::getOrderId, order.getId()));
        if (existingRecord == null) {
            ServiceRecord newRecord = ServiceRecord.builder()
                    .orderId(order.getId())
                    .staffId(attempt.getStaffId())
                    .actualStartAt(LocalDateTime.now())
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            serviceRecordMapper.insert(newRecord);
        } else {
            existingRecord.setStaffId(attempt.getStaffId());
            existingRecord.setActualStartAt(LocalDateTime.now());
            existingRecord.setUpdatedAt(LocalDateTime.now());
            serviceRecordMapper.updateById(existingRecord);
        }

        recordStatusLog(order.getId(), OrderStatus.WAIT_VISIT.getCode(), OrderStatus.IN_SERVICE.getCode(),
                String.format("服务人员#%d已到达现场，开始提供上门服务", attempt.getStaffId()));
    }

    /**
     * 服务人员完成服务并提交服务履约记录
     */
    @Transactional(rollbackFor = Exception.class)
    public void submitServiceRecord(ServiceRecord record) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        ServiceOrder order = serviceOrderMapper.selectByIdForUpdate(record.getOrderId());
        if (order == null) {
            throw new BusinessException("订单不存在");
        }

        if (!OrderStatus.IN_SERVICE.getCode().equals(order.getStatus())) {
            throw new BusinessException("只有服务中状态的订单才能提交服务记录");
        }

        if (order.getCurrentDispatchId() == null) {
            throw new BusinessException("订单无有效派单记录");
        }

        DispatchAttempt attempt = dispatchAttemptMapper.selectById(order.getCurrentDispatchId());
        if (attempt == null) {
            throw new BusinessException("未找到订单派单信息");
        }

        // 权限校验：仅允许当前被派单的服务人员提交履约记录
        StaffProfile staff = staffProfileMapper.selectOne(new LambdaQueryWrapper<StaffProfile>()
                .eq(StaffProfile::getUserId, currentUser.getId()));
        if (staff == null || !staff.getId().equals(attempt.getStaffId())) {
            throw new BusinessException(ResultCode.FORBIDDEN.getCode(), "只有当前接单的服务人员才能提交履约记录");
        }

        // 补齐 staffId
        record.setStaffId(attempt.getStaffId());

        ServiceRecord existing = serviceRecordMapper.selectOne(new LambdaQueryWrapper<ServiceRecord>()
                .eq(ServiceRecord::getOrderId, order.getId()));

        // 如果前端未传 actualStartAt，从已有记录获取，或兜底推断
        if (record.getActualStartAt() == null) {
            if (existing != null && existing.getActualStartAt() != null) {
                record.setActualStartAt(existing.getActualStartAt());
            } else {
                record.setActualStartAt(LocalDateTime.now().minusMinutes(30));
            }
        }

        if (record.getActualEndAt() == null) {
            record.setActualEndAt(LocalDateTime.now());
        }

        if (record.getActualEndAt().isBefore(record.getActualStartAt())) {
            throw new BusinessException("实际结束时间不能早于开始时间");
        }

        if (!StringUtils.hasText(record.getServiceSummary())) {
            throw new BusinessException("请填写服务情况与工作说明");
        }

        // 保存或更新履约记录
        if (existing == null) {
            record.setCreatedAt(LocalDateTime.now());
            record.setUpdatedAt(LocalDateTime.now());
            serviceRecordMapper.insert(record);
        } else {
            record.setId(existing.getId());
            record.setUpdatedAt(LocalDateTime.now());
            serviceRecordMapper.updateById(record);
        }

        // 释放或完结排班预留
        StaffBooking booking = staffBookingMapper.selectOne(new LambdaQueryWrapper<StaffBooking>()
                .eq(StaffBooking::getDispatchId, order.getCurrentDispatchId()));
        if (booking != null) {
            booking.setStatus(BookingStatus.FINISHED.getCode());
            booking.setUpdatedAt(LocalDateTime.now());
            staffBookingMapper.updateById(booking);
        }

        // 订单状态流转至 WAIT_CONFIRM (待老人或家属确认)
        order.setStatus(OrderStatus.WAIT_CONFIRM.getCode());
        order.setUpdatedAt(LocalDateTime.now());
        serviceOrderMapper.updateById(order);

        recordStatusLog(order.getId(), OrderStatus.IN_SERVICE.getCode(), OrderStatus.WAIT_CONFIRM.getCode(),
                String.format("服务人员#%d已提交服务记录，等待老人或家属确认完成", attempt.getStaffId()));
    }

    /**
     * 老人、家属或管理员确认服务完成
     */
    @Transactional(rollbackFor = Exception.class)
    public void confirmOrder(Long orderId, String note) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        ServiceOrder order = serviceOrderMapper.selectByIdForUpdate(orderId);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }

        if (!OrderStatus.WAIT_CONFIRM.getCode().equals(order.getStatus())) {
            throw new BusinessException("订单非待确认状态");
        }

        // 权限校验：非管理员只能由下单人或已绑定的老人/家属确认
        if (!UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())
                && !order.getRequesterUserId().equals(currentUser.getId())) {
            ElderProfile elder = elderProfileMapper.selectById(order.getElderId());
            elderProfileService.checkAccessPermission(elder);
        }

        order.setStatus(OrderStatus.COMPLETED.getCode());
        order.setConfirmedByUserId(currentUser.getId());
        order.setConfirmedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        serviceOrderMapper.updateById(order);

        // 累加服务人员累计完成订单数
        if (order.getCurrentDispatchId() != null) {
            DispatchAttempt attempt = dispatchAttemptMapper.selectById(order.getCurrentDispatchId());
            if (attempt != null) {
                StaffProfile staff = staffProfileMapper.selectById(attempt.getStaffId());
                if (staff != null) {
                    staff.setTotalOrders((staff.getTotalOrders() != null ? staff.getTotalOrders() : 0) + 1);
                    staff.setUpdatedAt(LocalDateTime.now());
                    staffProfileMapper.updateById(staff);
                }
            }
        }

        String confirmDesc = UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())
                ? "管理员核验代为确认完成: " + (note != null ? note : "情况属实")
                : "老人/家属确认服务圆满完成";

        recordStatusLog(order.getId(), OrderStatus.WAIT_CONFIRM.getCode(), OrderStatus.COMPLETED.getCode(), confirmDesc);
    }

    /**
     * 评价服务
     */
    @Transactional(rollbackFor = Exception.class)
    public void submitReview(ServiceReview review) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        ServiceOrder order = serviceOrderMapper.selectById(review.getOrderId());
        if (order == null) {
            throw new BusinessException("订单不存在");
        }

        if (!OrderStatus.COMPLETED.getCode().equals(order.getStatus())) {
            throw new BusinessException("订单尚未完成，暂无法评价");
        }

        // 权限校验：管理员不得代客评价（防止人为干预服务质量指标）；非下单人需校验老人关联授权
        if (UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())) {
            throw new BusinessException(403, "管理员不得代用户评价，以确保履约质量与派单数据客观真实");
        }
        if (!order.getRequesterUserId().equals(currentUser.getId())) {
            ElderProfile elder = elderProfileMapper.selectById(order.getElderId());
            elderProfileService.checkAccessPermission(elder);
        }

        Long existingCount = serviceReviewMapper.selectCount(new LambdaQueryWrapper<ServiceReview>()
                .eq(ServiceReview::getOrderId, order.getId()));
        if (existingCount > 0) {
            throw new BusinessException("该订单已完成评价，每单仅限一条评价");
        }

        if (review.getRating() == null || review.getRating() < 1 || review.getRating() > 5) {
            throw new BusinessException("评分必须在1到5星之间");
        }

        review.setElderId(order.getElderId());
        review.setReviewerUserId(currentUser.getId());
        review.setCreatedAt(LocalDateTime.now());
        serviceReviewMapper.insert(review);

        // 更新服务人员评分
        if (order.getCurrentDispatchId() != null) {
            DispatchAttempt attempt = dispatchAttemptMapper.selectById(order.getCurrentDispatchId());
            if (attempt != null) {
                updateStaffRating(attempt.getStaffId());
            }
        }
    }

    private void updateStaffRating(Long staffId) {
        List<ServiceReview> reviews = serviceReviewMapper.selectList(new LambdaQueryWrapper<ServiceReview>()
                .apply("order_id in (select order_id from dispatch_attempt where staff_id = {0} and status = 'ACCEPTED')", staffId));

        if (!reviews.isEmpty()) {
            double sum = reviews.stream().mapToInt(ServiceReview::getRating).sum();
            int n = reviews.size();
            // 平滑评分公式: (s + 5 * 4) / (n + 5)
            double smoothed = (sum + 5 * 4.0) / (n + 5);
            StaffProfile staff = staffProfileMapper.selectById(staffId);
            if (staff != null) {
                staff.setPriorRating(BigDecimal.valueOf(smoothed).setScale(2, RoundingMode.HALF_UP));
                staff.setUpdatedAt(LocalDateTime.now());
                staffProfileMapper.updateById(staff);
            }
        }
    }

    /**
     * 提交投诉
     */
    @Transactional(rollbackFor = Exception.class)
    public void submitComplaint(ServiceComplaint complaint) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        if (complaint.getOrderId() == null) {
            throw new BusinessException("请指定所要投诉的订单编号");
        }
        ServiceOrder order = serviceOrderMapper.selectById(complaint.getOrderId());
        if (order == null) {
            throw new BusinessException("目标订单不存在");
        }
        // 权限校验：仅下单人或关联老人/家属可以发起投诉
        if (!order.getRequesterUserId().equals(currentUser.getId())) {
            ElderProfile elder = elderProfileMapper.selectById(order.getElderId());
            elderProfileService.checkAccessPermission(elder);
        }

        complaint.setComplainantId(currentUser.getId());
        complaint.setStatus("PENDING");
        complaint.setCreatedAt(LocalDateTime.now());
        complaint.setUpdatedAt(LocalDateTime.now());
        serviceComplaintMapper.insert(complaint);
    }

    public Page<ServiceComplaint> pageComplaints(int pageNum, int pageSize, String status) {
        Page<ServiceComplaint> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ServiceComplaint> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(status)) {
            wrapper.eq(ServiceComplaint::getStatus, status);
        }
        wrapper.orderByDesc(ServiceComplaint::getCreatedAt);
        return serviceComplaintMapper.selectPage(page, wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public void handleComplaint(Long id, String result) {
        LoginUser currentUser = UserContext.getUser();
        ServiceComplaint complaint = serviceComplaintMapper.selectById(id);
        if (complaint == null) {
            throw new BusinessException("投诉记录不存在");
        }
        complaint.setStatus("RESOLVED");
        complaint.setHandleUserId(currentUser.getId());
        complaint.setHandleResult(result);
        complaint.setHandledAt(LocalDateTime.now());
        complaint.setUpdatedAt(LocalDateTime.now());
        serviceComplaintMapper.updateById(complaint);
    }

    private void recordStatusLog(Long orderId, String fromStatus, String toStatus, String reason) {
        LoginUser currentUser = UserContext.getUser();
        Long operatorId = currentUser != null ? currentUser.getId() : 0L;
        String operatorRole = currentUser != null ? currentUser.getRole() : "SYSTEM";

        OrderStatusLog logEntity = OrderStatusLog.builder()
                .orderId(orderId)
                .fromStatus(fromStatus)
                .toStatus(toStatus)
                .operatorId(operatorId)
                .operatorRole(operatorRole)
                .reason(reason)
                .createdAt(LocalDateTime.now())
                .build();
        orderStatusLogMapper.insert(logEntity);
    }
}
