package com.agedcare.dispatch;

import com.agedcare.common.enums.BookingStatus;
import com.agedcare.common.enums.DispatchStatus;
import com.agedcare.common.enums.OrderStatus;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.UserContext;
import com.agedcare.modules.dispatch.entity.DispatchAttempt;
import com.agedcare.modules.dispatch.entity.StaffBooking;
import com.agedcare.modules.dispatch.mapper.DispatchAttemptMapper;
import com.agedcare.modules.dispatch.mapper.StaffBookingMapper;
import com.agedcare.modules.dispatch.service.DispatchService;
import com.agedcare.modules.order.entity.ServiceOrder;
import com.agedcare.modules.order.mapper.ServiceOrderMapper;
import com.agedcare.modules.staff.entity.StaffProfile;
import com.agedcare.modules.staff.mapper.StaffProfileMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 调度系统高并发竞态与事务一致性深度测试:
 * 1. 两人同时抢接同一单 (并发争抢锁隔离)
 * 2. 人员接单与系统超时重派并发发生 (互斥安全验证)
 * 3. 派单异常中断后日程预留 StaffBooking 事务回滚保证
 */
@SpringBootTest
public class DispatchConcurrencyAndTransactionTest {

    @Autowired
    private DispatchService dispatchService;

    @Autowired
    private ServiceOrderMapper serviceOrderMapper;

    @Autowired
    private DispatchAttemptMapper dispatchAttemptMapper;

    @Autowired
    private StaffBookingMapper staffBookingMapper;

    @Autowired
    private StaffProfileMapper staffProfileMapper;

    private final List<Long> createdOrderIds = new ArrayList<>();
    private final List<Long> createdAttemptIds = new ArrayList<>();
    private final List<Long> createdBookingIds = new ArrayList<>();

    @AfterEach
    void tearDown() {
        UserContext.clear();
        for (Long bId : createdBookingIds) {
            staffBookingMapper.deleteById(bId);
        }
        for (Long aId : createdAttemptIds) {
            dispatchAttemptMapper.deleteById(aId);
        }
        for (Long oId : createdOrderIds) {
            serviceOrderMapper.deleteById(oId);
        }
    }

    private ServiceOrder createTestOrder(String orderNo, String status) {
        ServiceOrder order = ServiceOrder.builder()
                .orderNo(orderNo)
                .requesterUserId(5L)
                .elderId(201L)
                .serviceItemId(301L)
                .serviceNameSnapshot("居家照料并发测试")
                .priceSnapshot(new BigDecimal("99.00"))
                .durationMinutesSnapshot(60)
                .plannedStartAt(LocalDateTime.now().plusHours(2))
                .plannedEndAt(LocalDateTime.now().plusHours(3))
                .addressSnapshot("北京市海淀区中关村南大街测试路")
                .contactNameSnapshot("张大爷")
                .contactPhoneSnapshot("13800000001")
                .status(status)
                .dispatchRound(1)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        serviceOrderMapper.insert(order);
        createdOrderIds.add(order.getId());
        return order;
    }

    private DispatchAttempt createTestAttempt(Long orderId, Long staffId) {
        DispatchAttempt attempt = DispatchAttempt.builder()
                .orderId(orderId)
                .dispatchRound(1)
                .attemptNo(1)
                .staffId(staffId)
                .dispatchType("AUTO")
                .deadline(LocalDateTime.now().plusMinutes(5))
                .status(DispatchStatus.PENDING.getCode())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        dispatchAttemptMapper.insert(attempt);
        createdAttemptIds.add(attempt.getId());
        return attempt;
    }

    private StaffBooking createTestBooking(Long staffId, Long orderId, Long dispatchId) {
        StaffBooking booking = StaffBooking.builder()
                .staffId(staffId)
                .orderId(orderId)
                .dispatchId(dispatchId)
                .startTime(LocalDateTime.now().plusHours(2))
                .endTime(LocalDateTime.now().plusHours(3))
                .status(BookingStatus.HELD.getCode())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        staffBookingMapper.insert(booking);
        createdBookingIds.add(booking.getId());
        return booking;
    }

    @Test
    @DisplayName("并发测试1: 两人同时确认接单，必须有且仅有1人成功，另1人被CAS/悲观锁安全拦截")
    public void testConcurrentAcceptDispatchRaceCondition() throws Exception {
        // 获取测试服务人员 (以 ID 401 演示人员为例)
        StaffProfile staff = staffProfileMapper.selectList(new LambdaQueryWrapper<StaffProfile>().last("LIMIT 1")).get(0);
        Long staffId = staff.getId();
        Long staffUserId = staff.getUserId();

        // 创建待接单状态订单与待接单记录
        ServiceOrder order = createTestOrder("ORD_CONCURRENT_" + System.currentTimeMillis(), OrderStatus.WAIT_ACCEPT.getCode());
        DispatchAttempt attempt = createTestAttempt(order.getId(), staffId);
        StaffBooking booking = createTestBooking(staffId, order.getId(), attempt.getId());

        order.setCurrentDispatchId(attempt.getId());
        serviceOrderMapper.updateById(order);

        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CyclicBarrier barrier = new CyclicBarrier(threads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        List<String> failReasons = new CopyOnWriteArrayList<>();

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    // 每个线程持有合法身份
                    UserContext.setUser(LoginUser.builder()
                            .id(staffUserId)
                            .username("staff_user")
                            .role(UserRole.STAFF.getCode())
                            .build());

                    // 同一时刻起跑
                    barrier.await(5, TimeUnit.SECONDS);

                    dispatchService.acceptDispatch(attempt.getId());
                    successCount.incrementAndGet();
                } catch (BusinessException be) {
                    failCount.incrementAndGet();
                    failReasons.add(be.getMessage());
                } catch (Exception e) {
                    failCount.incrementAndGet();
                    failReasons.add(e.getClass().getSimpleName() + ": " + e.getMessage());
                } finally {
                    UserContext.clear();
                }
            });
        }

        executor.shutdown();
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS), "并发线程池应在10秒内执行完毕");

        // 核心并发断言:
        assertEquals(1, successCount.get(), "并发接单必须仅有1个请求成功");
        assertEquals(1, failCount.get(), "另一个并发接单必须被拦截");
        assertTrue(failReasons.get(0).contains("非待接单") || failReasons.get(0).contains("并发修改") || failReasons.get(0).contains("无法接单"),
                "被拦截原因应提示并发冲突或状态已变更: " + failReasons.get(0));

        // 数据库最终状态核对:
        ServiceOrder updatedOrder = serviceOrderMapper.selectById(order.getId());
        assertEquals(OrderStatus.WAIT_VISIT.getCode(), updatedOrder.getStatus(), "订单最终状态必须为待上门 WAIT_VISIT");

        DispatchAttempt updatedAttempt = dispatchAttemptMapper.selectById(attempt.getId());
        assertEquals(DispatchStatus.ACCEPTED.getCode(), updatedAttempt.getStatus(), "派单最终状态必须为已接受 ACCEPTED");

        StaffBooking updatedBooking = staffBookingMapper.selectById(booking.getId());
        assertEquals(BookingStatus.CONFIRMED.getCode(), updatedBooking.getStatus(), "排班预留最终状态必须为已确认 CONFIRMED");
    }

    @Test
    @DisplayName("并发测试2: 服务人员确认接单 与 超时调度重派 并发发生，互斥排队保证不发生双重派单")
    public void testAcceptVsTimeoutRaceCondition() throws Exception {
        StaffProfile staff = staffProfileMapper.selectList(new LambdaQueryWrapper<StaffProfile>().last("LIMIT 1")).get(0);
        Long staffId = staff.getId();
        Long staffUserId = staff.getUserId();

        ServiceOrder order = createTestOrder("ORD_TIMEOUT_RACE_" + System.currentTimeMillis(), OrderStatus.WAIT_ACCEPT.getCode());
        DispatchAttempt attempt = createTestAttempt(order.getId(), staffId);
        StaffBooking booking = createTestBooking(staffId, order.getId(), attempt.getId());

        order.setCurrentDispatchId(attempt.getId());
        serviceOrderMapper.updateById(order);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);

        AtomicInteger acceptSuccess = new AtomicInteger(0);
        AtomicInteger timeoutExecuted = new AtomicInteger(0);

        // 线程 1: 服务人员确认接单
        executor.submit(() -> {
            try {
                UserContext.setUser(LoginUser.builder()
                        .id(staffUserId)
                        .username("staff_user")
                        .role(UserRole.STAFF.getCode())
                        .build());
                barrier.await(5, TimeUnit.SECONDS);

                dispatchService.acceptDispatch(attempt.getId());
                acceptSuccess.incrementAndGet();
            } catch (Exception ignored) {
            } finally {
                UserContext.clear();
            }
        });

        // 线程 2: 系统调度器执行超时检查
        executor.submit(() -> {
            try {
                barrier.await(5, TimeUnit.SECONDS);
                dispatchService.handleTimeoutAttempt(attempt);
                timeoutExecuted.incrementAndGet();
            } catch (Exception ignored) {
            }
        });

        executor.shutdown();
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));

        // 状态互斥性验证:
        ServiceOrder finalOrder = serviceOrderMapper.selectById(order.getId());
        DispatchAttempt finalAttempt = dispatchAttemptMapper.selectById(attempt.getId());

        if (acceptSuccess.get() == 1) {
            // 接单获胜: 状态必须为 WAIT_VISIT，attempt 必须为 ACCEPTED，超时逻辑被短路跳过
            assertEquals(OrderStatus.WAIT_VISIT.getCode(), finalOrder.getStatus());
            assertEquals(DispatchStatus.ACCEPTED.getCode(), finalAttempt.getStatus());
        } else {
            // 超时获胜: attempt 必须为 EXPIRED，order 必须不再是此 attempt 的待接单
            assertEquals(DispatchStatus.EXPIRED.getCode(), finalAttempt.getStatus());
            assertNotEquals(OrderStatus.WAIT_VISIT.getCode(), finalOrder.getStatus());
        }
    }

    @Test
    @DisplayName("事务测试3: 非法订单状态调用 dispatchOrder 触发异常时，无任何残留预约或脏记录 (事务一致性回滚)")
    public void testDispatchTransactionRollbackOnFailure() {
        // 创建一个已经取消 CANCELLED 的非法订单
        ServiceOrder order = createTestOrder("ORD_ROLLBACK_" + System.currentTimeMillis(), OrderStatus.CANCELLED.getCode());

        // 尝试对非法状态订单派单，预期抛出 BusinessException
        assertThrows(BusinessException.class, () -> {
            dispatchService.dispatchOrder(order.getId(), null, "AUTO");
        });

        // 验证事务回滚:
        // 1. 不应有任何新增的 DispatchAttempt
        Long attemptCount = dispatchAttemptMapper.selectCount(new LambdaQueryWrapper<DispatchAttempt>()
                .eq(DispatchAttempt::getOrderId, order.getId()));
        assertEquals(0L, attemptCount, "发生异常时，派单尝试记录不应持久化 (事务已回滚)");

        // 2. 不应有任何新增的 StaffBooking
        Long bookingCount = staffBookingMapper.selectCount(new LambdaQueryWrapper<StaffBooking>()
                .eq(StaffBooking::getOrderId, order.getId()));
        assertEquals(0L, bookingCount, "发生异常时，排班预留不应残留孤立记录 (事务已回滚)");

        // 3. 订单状态未被错误串改
        ServiceOrder unchangedOrder = serviceOrderMapper.selectById(order.getId());
        assertEquals(OrderStatus.CANCELLED.getCode(), unchangedOrder.getStatus(), "订单原状态必须保持不变");
    }
}
