package com.agedcare.modules.order.service;

import com.agedcare.common.enums.BookingStatus;
import com.agedcare.common.enums.DispatchStatus;
import com.agedcare.common.enums.OrderStatus;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.UserContext;
import com.agedcare.common.utils.OrderNoGenerator;
import com.agedcare.modules.dispatch.entity.DispatchAttempt;
import com.agedcare.modules.dispatch.entity.StaffBooking;
import com.agedcare.modules.dispatch.mapper.DispatchAttemptMapper;
import com.agedcare.modules.dispatch.mapper.StaffBookingMapper;
import com.agedcare.modules.dispatch.service.DispatchService;
import com.agedcare.modules.elder.entity.ElderProfile;
import com.agedcare.modules.elder.mapper.ElderProfileMapper;
import com.agedcare.modules.elder.service.ElderProfileService;
import com.agedcare.modules.fulfillment.entity.ServiceRecord;
import com.agedcare.modules.fulfillment.entity.ServiceReview;
import com.agedcare.modules.fulfillment.mapper.ServiceRecordMapper;
import com.agedcare.modules.fulfillment.mapper.ServiceReviewMapper;
import com.agedcare.modules.order.dto.OrderCreateDTO;
import com.agedcare.modules.order.dto.OrderQueryDTO;
import com.agedcare.modules.order.dto.OrderTrackingVO;
import com.agedcare.modules.order.dto.OrderVO;
import com.agedcare.modules.order.entity.OrderStatusLog;
import com.agedcare.modules.order.entity.ServiceOrder;
import com.agedcare.modules.order.mapper.OrderStatusLogMapper;
import com.agedcare.modules.order.mapper.ServiceOrderMapper;
import com.agedcare.modules.serviceitem.entity.ServiceItem;
import com.agedcare.modules.serviceitem.mapper.ServiceItemMapper;
import com.agedcare.modules.staff.dto.StaffDetailVO;
import com.agedcare.modules.staff.entity.StaffProfile;
import com.agedcare.modules.staff.mapper.StaffProfileMapper;
import com.agedcare.modules.staff.service.StaffService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final ServiceOrderMapper serviceOrderMapper;
    private final OrderStatusLogMapper orderStatusLogMapper;
    private final ServiceItemMapper serviceItemMapper;
    private final ElderProfileMapper elderProfileMapper;
    private final ElderProfileService elderProfileService;
    private final StaffProfileMapper staffProfileMapper;
    private final StaffService staffService;
    private final DispatchAttemptMapper dispatchAttemptMapper;
    private final StaffBookingMapper staffBookingMapper;
    private final ServiceRecordMapper serviceRecordMapper;
    private final ServiceReviewMapper serviceReviewMapper;
    private final DispatchService dispatchService;

    @Transactional(rollbackFor = Exception.class)
    public ServiceOrder createOrder(OrderCreateDTO dto) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException("请先登录后下单");
        }

        // 1. 幂等性校验 (用户作用域 + 核心字段摘要比对)
        if (StringUtils.hasText(dto.getIdempotencyKey())) {
            ServiceOrder existing = serviceOrderMapper.selectOne(new LambdaQueryWrapper<ServiceOrder>()
                    .eq(ServiceOrder::getIdempotencyKey, dto.getIdempotencyKey()));
            if (existing != null) {
                if (!existing.getRequesterUserId().equals(currentUser.getId())) {
                    throw new BusinessException(409, "幂等键已被其他请求占用，请重试");
                }
                // 相同幂等键，如果关键参数一致，返回已有订单；如果不一致，拒绝处理
                boolean paramsMatch = existing.getElderId().equals(dto.getElderId())
                        && existing.getServiceItemId().equals(dto.getServiceItemId())
                        && existing.getPlannedStartAt().equals(dto.getPlannedStartAt())
                        && Objects.equals(existing.getAddressSnapshot(), dto.getAddress());
                if (paramsMatch) {
                    log.info("命中当前用户重复提交幂等键: {}", dto.getIdempotencyKey());
                    return existing;
                } else {
                    throw new BusinessException(409, "相同幂等键对应不同参数内容，拒绝处理");
                }
            }
        }

        // 2. 权限校验: 下单人是否有权为该老人预约
        ElderProfile elder = elderProfileMapper.selectById(dto.getElderId());
        if (elder == null) {
            throw new BusinessException("老人档案不存在");
        }
        elderProfileService.checkAccessPermission(elder);

        // 3. 服务项目校验
        ServiceItem item = serviceItemMapper.selectById(dto.getServiceItemId());
        if (item == null || !"ON_SHELF".equals(item.getStatus())) {
            throw new BusinessException("该服务项目已下架或不存在");
        }

        // 4. 预约时间校验
        LocalDateTime now = LocalDateTime.now();
        if (dto.getPlannedStartAt().isBefore(now.plusMinutes(29))) {
            throw new BusinessException("预约开始时间必须至少提前30分钟");
        }

        // 首版限制: 不允许跨日预约
        int durationMinutes = item.getDurationMinutes();
        LocalDateTime plannedEndAt = dto.getPlannedStartAt().plusMinutes(durationMinutes);
        if (!dto.getPlannedStartAt().toLocalDate().isEqual(plannedEndAt.toLocalDate())) {
            throw new BusinessException("服务时段不可跨日");
        }

        BigDecimal latitude = dto.getLatitude();
        BigDecimal longitude = dto.getLongitude();
        if ((latitude == null) != (longitude == null)) {
            throw new BusinessException("请同时提供有效的经纬度");
        }
        if (latitude != null && !validCoordinates(latitude, longitude)) {
            throw new BusinessException("经纬度超出有效范围");
        }
        // Only reuse a location when it belongs to the same address snapshot.
        if (latitude == null && Objects.equals(dto.getAddress().trim(), elder.getAddress() == null ? null : elder.getAddress().trim())
                && validCoordinates(elder.getLatitude(), elder.getLongitude())) {
            latitude = elder.getLatitude();
            longitude = elder.getLongitude();
        }

        // 5. 保存快照并创建订单实体
        ServiceOrder order = ServiceOrder.builder()
                .orderNo(OrderNoGenerator.generateOrderNo())
                .requesterUserId(currentUser.getId())
                .elderId(elder.getId())
                .serviceItemId(item.getId())
                .serviceNameSnapshot(item.getName())
                .serviceDescriptionSnapshot(item.getDescription())
                .requiredSkillsSnapshot(item.getRequiredSkills() != null ? item.getRequiredSkills() : "")
                .priceSnapshot(item.getPrice())
                .durationMinutesSnapshot(durationMinutes)
                .plannedStartAt(dto.getPlannedStartAt())
                .plannedEndAt(plannedEndAt)
                .addressSnapshot(dto.getAddress())
                .longitude(longitude)
                .latitude(latitude)
                .coordinateType(StringUtils.hasText(dto.getCoordinateType()) ? dto.getCoordinateType() : "GCJ02")
                .contactNameSnapshot(dto.getContactName())
                .contactPhoneSnapshot(dto.getContactPhone())
                .remark(dto.getRemark() != null ? dto.getRemark() : "")
                .status(OrderStatus.WAIT_DISPATCH.getCode())
                .dispatchRound(1)
                .idempotencyKey(dto.getIdempotencyKey())
                .version(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        serviceOrderMapper.insert(order);

        // 记录状态初始日志
        OrderStatusLog logEntity = OrderStatusLog.builder()
                .orderId(order.getId())
                .fromStatus(null)
                .toStatus(OrderStatus.WAIT_DISPATCH.getCode())
                .operatorId(currentUser.getId())
                .operatorRole(currentUser.getRole())
                .reason("居民提交服务预约订单")
                .createdAt(LocalDateTime.now())
                .build();
        orderStatusLogMapper.insert(logEntity);

        // 立即尝试发起智能派单
        try {
            dispatchService.dispatchOrder(order.getId(), null, "AUTO");
        } catch (Exception e) {
            log.warn("下单后立即自动派单未完成(将由调度器继续处理): {}", e.getMessage());
        }

        return serviceOrderMapper.selectById(order.getId());
    }

    private static boolean validCoordinates(BigDecimal latitude, BigDecimal longitude) {
        return latitude != null && longitude != null
                && latitude.abs().compareTo(BigDecimal.valueOf(90)) <= 0
                && longitude.abs().compareTo(BigDecimal.valueOf(180)) <= 0;
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancelOrder(Long orderId, String cancelReason) {
        LoginUser currentUser = UserContext.getUser();
        ServiceOrder order = serviceOrderMapper.selectByIdForUpdate(orderId);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }

        OrderStatus currentStatus = order.getStatusEnum();
        if (currentStatus == null || !currentStatus.canCancel()) {
            throw new BusinessException("订单当前状态处于[" + (currentStatus != null ? currentStatus.getDesc() : order.getStatus()) + "]，服务已开始或已结束，无法取消");
        }

        // 权限校验
        if (!UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())
                && !order.getRequesterUserId().equals(currentUser.getId())) {
            // 家属也可以取消其授权老人的订单
            ElderProfile elder = elderProfileMapper.selectById(order.getElderId());
            elderProfileService.checkAccessPermission(elder);
        }

        // 撤销生效中的派单及预留
        if (order.getCurrentDispatchId() != null) {
            DispatchAttempt attempt = dispatchAttemptMapper.selectById(order.getCurrentDispatchId());
            if (attempt != null && (DispatchStatus.PENDING.getCode().equals(attempt.getStatus()) || DispatchStatus.ACCEPTED.getCode().equals(attempt.getStatus()))) {
                attempt.setStatus(DispatchStatus.REVOKED.getCode());
                attempt.setRevokedAt(LocalDateTime.now());
                attempt.setRevokeReason("订单取消撤销分配");
                attempt.setUpdatedAt(LocalDateTime.now());
                dispatchAttemptMapper.updateById(attempt);

                StaffBooking booking = staffBookingMapper.selectOne(new LambdaQueryWrapper<StaffBooking>()
                        .eq(StaffBooking::getDispatchId, attempt.getId()));
                if (booking != null) {
                    booking.setStatus(BookingStatus.RELEASED.getCode());
                    booking.setUpdatedAt(LocalDateTime.now());
                    staffBookingMapper.updateById(booking);
                }
            }
        }

        String oldStatus = order.getStatus();
        order.setStatus(OrderStatus.CANCELLED.getCode());
        order.setCancelReason(cancelReason != null ? cancelReason : "用户主动取消");
        order.setCancelledAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        serviceOrderMapper.updateById(order);

        OrderStatusLog logEntity = OrderStatusLog.builder()
                .orderId(order.getId())
                .fromStatus(oldStatus)
                .toStatus(OrderStatus.CANCELLED.getCode())
                .operatorId(currentUser.getId())
                .operatorRole(currentUser.getRole())
                .reason("取消订单: " + order.getCancelReason())
                .createdAt(LocalDateTime.now())
                .build();
        orderStatusLogMapper.insert(logEntity);
    }

    public Page<OrderVO> pageOrders(OrderQueryDTO query) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException("未登录");
        }

        Page<ServiceOrder> page = new Page<>(query.getPageNum(), query.getPageSize());
        LambdaQueryWrapper<ServiceOrder> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(query.getOrderNo())) {
            wrapper.like(ServiceOrder::getOrderNo, query.getOrderNo());
        }
        if (StringUtils.hasText(query.getStatus())) {
            if (query.getStatus().contains(",")) {
                List<String> statusList = Arrays.stream(query.getStatus().split(","))
                        .map(String::trim)
                        .filter(StringUtils::hasText)
                        .collect(Collectors.toList());
                wrapper.in(ServiceOrder::getStatus, statusList);
            } else {
                wrapper.eq(ServiceOrder::getStatus, query.getStatus().trim());
            }
        }
        if (query.getElderId() != null) {
            wrapper.eq(ServiceOrder::getElderId, query.getElderId());
        }

        // 角色数据隔离过滤
        if (UserRole.RESIDENT.getCode().equalsIgnoreCase(currentUser.getRole())) {
            // 查询可访问的所有老人ID
            List<ElderProfile> accessibleElders = elderProfileService.getAccessibleElders();
            List<Long> elderIds = accessibleElders.stream().map(ElderProfile::getId).collect(Collectors.toList());

            wrapper.and(w -> {
                w.eq(ServiceOrder::getRequesterUserId, currentUser.getId());
                if (!elderIds.isEmpty()) {
                    w.or().in(ServiceOrder::getElderId, elderIds);
                }
            });
        } else if (UserRole.STAFF.getCode().equalsIgnoreCase(currentUser.getRole())) {
            StaffProfile staff = staffProfileMapper.selectOne(new LambdaQueryWrapper<StaffProfile>()
                    .eq(StaffProfile::getUserId, currentUser.getId()));
            if (staff != null) {
                wrapper.apply("id in (select order_id from dispatch_attempt where staff_id = {0} and status in ('PENDING', 'ACCEPTED'))", staff.getId());
            } else {
                return new Page<>(query.getPageNum(), query.getPageSize(), 0);
            }
        }

        wrapper.orderByDesc(ServiceOrder::getCreatedAt);
        Page<ServiceOrder> orderPage = serviceOrderMapper.selectPage(page, wrapper);

        List<OrderVO> voList = orderPage.getRecords().stream()
                .map(this::assembleOrderVO)
                .collect(Collectors.toList());

        Page<OrderVO> resultPage = new Page<>(orderPage.getCurrent(), orderPage.getSize(), orderPage.getTotal());
        resultPage.setRecords(voList);
        return resultPage;
    }

    public OrderVO getOrderDetail(Long orderId) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException(com.agedcare.common.api.ResultCode.UNAUTHORIZED);
        }
        ServiceOrder order = serviceOrderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }

        // 对象级访问权限校验 (修复 B2)
        if (!UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())) {
            if (UserRole.RESIDENT.getCode().equalsIgnoreCase(currentUser.getRole())) {
                boolean isRequester = order.getRequesterUserId().equals(currentUser.getId());
                if (!isRequester) {
                    ElderProfile elder = elderProfileMapper.selectById(order.getElderId());
                    if (elder == null) {
                        throw new BusinessException(403, "无权查看该订单详情");
                    }
                    elderProfileService.checkAccessPermission(elder);
                }
            } else if (UserRole.STAFF.getCode().equalsIgnoreCase(currentUser.getRole())) {
                StaffProfile staff = staffProfileMapper.selectOne(new LambdaQueryWrapper<StaffProfile>()
                        .eq(StaffProfile::getUserId, currentUser.getId()));
                if (staff == null) {
                    throw new BusinessException(403, "未找到关联服务人员档案");
                }
                Long assignedCount = dispatchAttemptMapper.selectCount(new LambdaQueryWrapper<DispatchAttempt>()
                        .eq(DispatchAttempt::getOrderId, order.getId())
                        .eq(DispatchAttempt::getStaffId, staff.getId()));
                if (assignedCount == null || assignedCount == 0) {
                    throw new BusinessException(403, "服务人员无权查看非指派给本人的订单详情");
                }
            }
        }

        return assembleOrderVO(order);
    }

    private OrderVO assembleOrderVO(ServiceOrder order) {
        OrderVO vo = new OrderVO();
        vo.setOrder(order);
        vo.setElder(elderProfileMapper.selectById(order.getElderId()));

        if (order.getCurrentDispatchId() != null) {
            DispatchAttempt attempt = dispatchAttemptMapper.selectById(order.getCurrentDispatchId());
            vo.setCurrentDispatch(attempt);
            if (attempt != null) {
                vo.setCurrentStaff(staffService.getStaffDetail(attempt.getStaffId()));
            }
        }

        vo.setServiceRecord(serviceRecordMapper.selectOne(new LambdaQueryWrapper<ServiceRecord>()
                .eq(ServiceRecord::getOrderId, order.getId())));
        vo.setServiceReview(serviceReviewMapper.selectOne(new LambdaQueryWrapper<ServiceReview>()
                .eq(ServiceReview::getOrderId, order.getId())));
        vo.setLogs(orderStatusLogMapper.selectList(new LambdaQueryWrapper<OrderStatusLog>()
                .eq(OrderStatusLog::getOrderId, order.getId())
                .orderByAsc(OrderStatusLog::getCreatedAt)));
        vo.setTracking(buildTrackingVO(order));

        return vo;
    }

    public OrderTrackingVO getOrderTracking(Long orderId) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException(com.agedcare.common.api.ResultCode.UNAUTHORIZED);
        }
        ServiceOrder order = serviceOrderMapper.selectById(orderId);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }

        // 对象级访问权限校验
        if (!UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())) {
            if (UserRole.RESIDENT.getCode().equalsIgnoreCase(currentUser.getRole())) {
                boolean isRequester = order.getRequesterUserId().equals(currentUser.getId());
                if (!isRequester) {
                    ElderProfile elder = elderProfileMapper.selectById(order.getElderId());
                    if (elder == null) {
                        throw new BusinessException(403, "无权查看该订单轨迹");
                    }
                    elderProfileService.checkAccessPermission(elder);
                }
            } else if (UserRole.STAFF.getCode().equalsIgnoreCase(currentUser.getRole())) {
                StaffProfile staff = staffProfileMapper.selectOne(new LambdaQueryWrapper<StaffProfile>()
                        .eq(StaffProfile::getUserId, currentUser.getId()));
                if (staff == null) {
                    throw new BusinessException(403, "未找到关联服务人员档案");
                }
                Long assignedCount = dispatchAttemptMapper.selectCount(new LambdaQueryWrapper<DispatchAttempt>()
                        .eq(DispatchAttempt::getOrderId, order.getId())
                        .eq(DispatchAttempt::getStaffId, staff.getId()));
                if (assignedCount == null || assignedCount == 0) {
                    throw new BusinessException(403, "服务人员无权查看非指派给本人的订单轨迹");
                }
            }
        }

        return buildTrackingVO(order);
    }

    public OrderTrackingVO buildTrackingVO(ServiceOrder order) {
        OrderTrackingVO vo = new OrderTrackingVO();
        vo.setOrderId(order.getId());
        vo.setOrderNo(order.getOrderNo());
        vo.setStatus(order.getStatus());
        vo.setServiceName(order.getServiceNameSnapshot());
        vo.setDestAddress(order.getAddressSnapshot());
        vo.setElderName(order.getContactNameSnapshot());
        vo.setContactPhone(order.getContactPhoneSnapshot());

        java.math.BigDecimal destLon = order.getLongitude();
        java.math.BigDecimal destLat = order.getLatitude();
        if (destLon == null || destLat == null) {
            ElderProfile elder = elderProfileMapper.selectById(order.getElderId());
            if (elder != null) {
                if (destLon == null && destLat == null
                        && Objects.equals(order.getAddressSnapshot(), elder.getAddress())
                        && validCoordinates(elder.getLatitude(), elder.getLongitude())) {
                    destLon = elder.getLongitude();
                    destLat = elder.getLatitude();
                }
                if (!StringUtils.hasText(vo.getElderName())) vo.setElderName(elder.getName());
                if (!StringUtils.hasText(vo.getContactPhone())) vo.setContactPhone(elder.getPhone());
                if (!StringUtils.hasText(vo.getDestAddress())) vo.setDestAddress(elder.getAddress());
            }
        }
        if (!validCoordinates(destLat, destLon)) {
            destLat = null;
            destLon = null;
        }
        vo.setDestLongitude(destLon);
        vo.setDestLatitude(destLat);

        if (order.getCurrentDispatchId() != null) {
            DispatchAttempt attempt = dispatchAttemptMapper.selectById(order.getCurrentDispatchId());
            if (attempt != null && attempt.getStaffId() != null) {
                StaffProfile staff = staffProfileMapper.selectById(attempt.getStaffId());
                if (staff != null) {
                    vo.setStaffId(staff.getId());
                    vo.setStaffLongitude(staff.getCurrentLongitude());
                    vo.setStaffLatitude(staff.getCurrentLatitude());
                    vo.setLocationUpdatedAt(staff.getLocationUpdatedAt());

                    // 位置新鲜度判断 (超过5分钟无上报即为陈旧位置，防止误解为正在赶往)
                    LocalDateTime locTime = staff.getLocationUpdatedAt();
                    if (locTime != null) {
                        long minutesAgo = java.time.Duration.between(locTime, LocalDateTime.now()).toMinutes();
                        if (minutesAgo > 5) {
                            vo.setIsStale(true);
                            vo.setLocationStatusText(minutesAgo >= 60
                                    ? "位置暂未更新(超1小时前)"
                                    : String.format("位置暂未更新(%d分钟前)", minutesAgo));
                        } else {
                            vo.setIsStale(false);
                            vo.setLocationStatusText(minutesAgo <= 1 ? "刚刚更新" : String.format("%d分钟前更新", minutesAgo));
                        }
                    } else {
                        vo.setIsStale(true);
                        vo.setLocationStatusText("暂未上报实时位置");
                    }

                    StaffDetailVO staffDetail = staffService.getStaffDetail(staff.getId());
                    if (staffDetail != null && staffDetail.getUser() != null) {
                        vo.setStaffName(staffDetail.getUser().getRealName());
                        vo.setStaffPhone(staffDetail.getUser().getPhone());
                    }
                }
            }
        }

        if (vo.getStaffLatitude() != null && vo.getStaffLongitude() != null
                && vo.getDestLatitude() != null && vo.getDestLongitude() != null) {
            double dist = calculateDistanceMeters(
                    vo.getStaffLatitude().doubleValue(),
                    vo.getStaffLongitude().doubleValue(),
                    vo.getDestLatitude().doubleValue(),
                    vo.getDestLongitude().doubleValue()
            );
            int distInt = (int) Math.round(dist);
            vo.setDistanceMeters(distInt);
            int minutes = distInt <= 50 ? 1 : (int) Math.ceil(distInt / 250.0);
            vo.setEstimatedMinutes(minutes);
        }

        return vo;
    }

    public static double calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000;
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
