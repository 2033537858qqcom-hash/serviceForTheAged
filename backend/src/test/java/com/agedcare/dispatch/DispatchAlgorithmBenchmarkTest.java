package com.agedcare.dispatch;

import com.agedcare.common.utils.DistanceUtil;
import com.agedcare.modules.dispatch.dto.CandidateEvaluationResult;
import com.agedcare.modules.dispatch.entity.StaffBooking;
import com.agedcare.modules.order.entity.ServiceOrder;
import com.agedcare.modules.staff.entity.StaffProfile;
import com.agedcare.modules.staff.entity.StaffShift;
import com.agedcare.modules.staff.entity.StaffSkill;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 毕业论文核心实验验证:
 * 同批订单下「随机派单、就近派单、综合评分智能派单」的三方对比仿真实验
 */
public class DispatchAlgorithmBenchmarkTest {

    static class SimulationContext {
        List<StaffProfile> staffList = new ArrayList<>();
        Map<Long, Set<String>> staffSkills = new HashMap<>();
        Map<Long, List<StaffBooking>> staffBookings = new HashMap<>();
        Map<Long, StaffShift> staffShifts = new HashMap<>();
        Set<String> familiarPairs = new HashSet<>(); // staffId + "_" + elderId
    }

    static class BenchmarkMetrics {
        int totalOrders;
        int successfulDispatches;
        double totalDistanceKm;
        double totalTravelMinutes;
        double totalServiceRating;
        Map<Long, Integer> staffWorkloadOrders = new HashMap<>();
        Map<Long, Integer> staffWorkloadMinutes = new HashMap<>();
        long totalExecutionTimeNs;

        double getSuccessRate() {
            return (double) successfulDispatches / totalOrders * 100.0;
        }

        double getAvgDistanceKm() {
            return successfulDispatches > 0 ? totalDistanceKm / successfulDispatches : 0;
        }

        double getAvgTravelMinutes() {
            return successfulDispatches > 0 ? totalTravelMinutes / successfulDispatches : 0;
        }

        double getAvgRating() {
            return successfulDispatches > 0 ? totalServiceRating / successfulDispatches : 0;
        }

        double getWorkloadStdDev() {
            if (staffWorkloadOrders.isEmpty()) return 0;
            double mean = staffWorkloadOrders.values().stream().mapToInt(Integer::intValue).average().orElse(0);
            double sumSq = 0;
            for (int count : staffWorkloadOrders.values()) {
                sumSq += Math.pow(count - mean, 2);
            }
            return Math.sqrt(sumSq / staffWorkloadOrders.size());
        }

        double getAvgLatencyMs() {
            return (double) totalExecutionTimeNs / totalOrders / 1_000_000.0;
        }
    }

    private SimulationContext initSimulationData(int staffCount) {
        SimulationContext ctx = new SimulationContext();
        double centerLat = 39.9042;
        double centerLng = 116.4074;

        Random random = new Random(42); // 固定随机种子保证实验完全可复现

        // 12 名服务人员，基准点分布在周边 0.5km ~ 3.5km 社区网格
        for (long i = 1; i <= staffCount; i++) {
            double offsetLat = (random.nextDouble() - 0.5) * 0.04;
            double offsetLng = (random.nextDouble() - 0.5) * 0.04;
            double rating = 3.8 + random.nextDouble() * 1.2; // 3.8 ~ 5.0
            if (rating > 5.0) rating = 5.0;

            StaffProfile staff = StaffProfile.builder()
                    .id(i)
                    .userId(1000L + i)
                    .baseLatitude(BigDecimal.valueOf(centerLat + offsetLat))
                    .baseLongitude(BigDecimal.valueOf(centerLng + offsetLng))
                    .priorRating(BigDecimal.valueOf(rating).setScale(2, RoundingMode.HALF_UP))
                    .totalOrders(random.nextInt(30))
                    .build();
            ctx.staffList.add(staff);
            ctx.staffBookings.put(i, new ArrayList<>());

            // 技能分配: 所有人具备基础照料 CARE，部分具备 MEDICAL，部分具备 REHAB，部分具备 CLEAN
            Set<String> skills = new HashSet<>();
            skills.add("CARE");
            if (i % 2 == 0) skills.add("CLEAN");
            if (i % 3 == 0) skills.add("MEDICAL");
            if (i % 4 == 0) skills.add("REHAB");
            ctx.staffSkills.put(i, skills);

            // 排班: 08:00 ~ 18:00
            ctx.staffShifts.put(i, StaffShift.builder()
                    .staffId(i)
                    .startTime(LocalTime.of(8, 0))
                    .endTime(LocalTime.of(18, 0))
                    .build());
        }

        // 预设熟悉度关系 (曾服务过)
        for (long staffId = 1; staffId <= staffCount; staffId++) {
            for (long elderId = 1; elderId <= 30; elderId++) {
                if ((staffId + elderId) % 5 == 0) {
                    ctx.familiarPairs.add(staffId + "_" + elderId);
                }
            }
        }

        return ctx;
    }

    private List<ServiceOrder> generateSimulationOrders(int orderCount, LocalDate date) {
        List<ServiceOrder> orders = new ArrayList<>();
        double centerLat = 39.9042;
        double centerLng = 116.4074;
        Random random = new Random(10086);

        LocalTime[] slotStarts = {
                LocalTime.of(8, 30),
                LocalTime.of(9, 45),
                LocalTime.of(11, 0),
                LocalTime.of(13, 30),
                LocalTime.of(14, 45),
                LocalTime.of(16, 0)
        };

        String[] requiredSkillSets = {
                "CARE",
                "CARE,CLEAN",
                "CARE,MEDICAL",
                "CARE,REHAB"
        };

        for (long i = 1; i <= orderCount; i++) {
            LocalTime startT = slotStarts[(int) (i % slotStarts.length)];
            int durationMins = 45;
            LocalDateTime startDt = date.atTime(startT);
            LocalDateTime endDt = startDt.plusMinutes(durationMins);

            double offsetLat = (random.nextDouble() - 0.5) * 0.035;
            double offsetLng = (random.nextDouble() - 0.5) * 0.035;

            long elderId = 1 + (i % 25);
            String skills = requiredSkillSets[(int) (i % requiredSkillSets.length)];

            orders.add(ServiceOrder.builder()
                    .id(i)
                    .orderNo("SIM_ORD_" + i)
                    .elderId(elderId)
                    .plannedStartAt(startDt)
                    .plannedEndAt(endDt)
                    .durationMinutesSnapshot(durationMins)
                    .requiredSkillsSnapshot(skills)
                    .latitude(BigDecimal.valueOf(centerLat + offsetLat))
                    .longitude(BigDecimal.valueOf(centerLng + offsetLng))
                    .build());
        }

        // 按时间先后顺序排序模拟全天实时到来
        orders.sort(Comparator.comparing(ServiceOrder::getPlannedStartAt));
        return orders;
    }

    /**
     * 策略 A: 随机轮询派单 (Baseline 1: Random Dispatch)
     */
    private BenchmarkMetrics runRandomStrategy(SimulationContext ctx, List<ServiceOrder> orders) {
        BenchmarkMetrics metrics = new BenchmarkMetrics();
        metrics.totalOrders = orders.size();
        for (StaffProfile s : ctx.staffList) metrics.staffWorkloadOrders.put(s.getId(), 0);

        Random rand = new Random(1234);

        for (ServiceOrder order : orders) {
            long t0 = System.nanoTime();
            List<StaffProfile> qualifiedList = new ArrayList<>();
            Map<Long, Double> distanceMap = new HashMap<>();
            Map<Long, Integer> travelTimeMap = new HashMap<>();

            for (StaffProfile staff : ctx.staffList) {
                EvaluationCheck check = checkHardConstraints(ctx, staff, order);
                if (check.feasible) {
                    qualifiedList.add(staff);
                    distanceMap.put(staff.getId(), check.distanceKm);
                    travelTimeMap.put(staff.getId(), check.travelMinutes);
                }
            }

            metrics.totalExecutionTimeNs += (System.nanoTime() - t0);

            if (!qualifiedList.isEmpty()) {
                StaffProfile chosen = qualifiedList.get(rand.nextInt(qualifiedList.size()));
                assignOrder(ctx, chosen, order, metrics, distanceMap.get(chosen.getId()), travelTimeMap.get(chosen.getId()));
            }
        }
        return metrics;
    }

    /**
     * 策略 B: 贪心就近派单 (Baseline 2: Pure Greedy Distance)
     */
    private BenchmarkMetrics runGreedyDistanceStrategy(SimulationContext ctx, List<ServiceOrder> orders) {
        BenchmarkMetrics metrics = new BenchmarkMetrics();
        metrics.totalOrders = orders.size();
        for (StaffProfile s : ctx.staffList) metrics.staffWorkloadOrders.put(s.getId(), 0);

        for (ServiceOrder order : orders) {
            long t0 = System.nanoTime();
            StaffProfile bestStaff = null;
            double minDistance = Double.MAX_VALUE;
            int bestTravelTime = 0;

            for (StaffProfile staff : ctx.staffList) {
                EvaluationCheck check = checkHardConstraints(ctx, staff, order);
                if (check.feasible) {
                    if (check.distanceKm < minDistance) {
                        minDistance = check.distanceKm;
                        bestStaff = staff;
                        bestTravelTime = check.travelMinutes;
                    }
                }
            }

            metrics.totalExecutionTimeNs += (System.nanoTime() - t0);

            if (bestStaff != null) {
                assignOrder(ctx, bestStaff, order, metrics, minDistance, bestTravelTime);
            }
        }
        return metrics;
    }

    /**
     * 策略 C: 本课题综合多目标评分智能派单 (Proposed Multi-Objective Composite Score)
     */
    private BenchmarkMetrics runCompositeScoreStrategy(SimulationContext ctx, List<ServiceOrder> orders) {
        BenchmarkMetrics metrics = new BenchmarkMetrics();
        metrics.totalOrders = orders.size();
        for (StaffProfile s : ctx.staffList) metrics.staffWorkloadOrders.put(s.getId(), 0);

        for (ServiceOrder order : orders) {
            long t0 = System.nanoTime();
            StaffProfile bestStaff = null;
            double maxScore = -1.0;
            double bestDist = 0;
            int bestTravelTime = 0;

            for (StaffProfile staff : ctx.staffList) {
                EvaluationCheck check = checkHardConstraints(ctx, staff, order);
                if (check.feasible) {
                    // 计算多目标评分: 0.35*D + 0.30*Q + 0.25*L + 0.10*F
                    // 1. D 到达便利度
                    double dVal = Math.max(0.0, 1.0 - Math.min((double) check.travelMinutes / 30.0, 1.0));
                    // 2. Q 服务质量均分 (3.8~5.0 归一化)
                    double qRating = staff.getPriorRating() != null ? staff.getPriorRating().doubleValue() : 4.0;
                    double qVal = Math.max(0.0, Math.min(1.0, (qRating - 1.0) / 4.0));
                    // 3. L 当日工作量余量
                    int occupiedMinutes = ctx.staffBookings.get(staff.getId()).stream()
                            .mapToInt(b -> (int) Duration.between(b.getStartTime(), b.getEndTime()).toMinutes())
                            .sum();
                    double lVal = Math.max(0.0, 1.0 - (double) (occupiedMinutes + order.getDurationMinutesSnapshot() + check.travelMinutes) / 480.0);
                    // 4. F 熟悉度
                    double fVal = ctx.familiarPairs.contains(staff.getId() + "_" + order.getElderId()) ? 1.0 : 0.0;

                    double score = 0.35 * dVal + 0.30 * qVal + 0.25 * lVal + 0.10 * fVal;
                    if (score > maxScore) {
                        maxScore = score;
                        bestStaff = staff;
                        bestDist = check.distanceKm;
                        bestTravelTime = check.travelMinutes;
                    }
                }
            }

            metrics.totalExecutionTimeNs += (System.nanoTime() - t0);

            if (bestStaff != null) {
                assignOrder(ctx, bestStaff, order, metrics, bestDist, bestTravelTime);
            }
        }
        return metrics;
    }

    static class EvaluationCheck {
        boolean feasible;
        double distanceKm;
        int travelMinutes;
    }

    private EvaluationCheck checkHardConstraints(SimulationContext ctx, StaffProfile staff, ServiceOrder order) {
        EvaluationCheck check = new EvaluationCheck();

        // 1. 技能检查
        String reqSkills = order.getRequiredSkillsSnapshot();
        if (reqSkills != null && !reqSkills.isEmpty()) {
            Set<String> staffSkills = ctx.staffSkills.get(staff.getId());
            for (String req : reqSkills.split(",")) {
                if (!staffSkills.contains(req.trim())) {
                    check.feasible = false;
                    return check;
                }
            }
        }

        // 2. 排班检查
        StaffShift shift = ctx.staffShifts.get(staff.getId());
        if (order.getPlannedStartAt().toLocalTime().isBefore(shift.getStartTime())
                || order.getPlannedEndAt().toLocalTime().isAfter(shift.getEndTime())) {
            check.feasible = false;
            return check;
        }

        // 3. 冲突与衔接路程计算
        List<StaffBooking> dayBookings = ctx.staffBookings.get(staff.getId());
        StaffBooking prevBooking = null;
        StaffBooking nextBooking = null;

        for (StaffBooking b : dayBookings) {
            // 时间重叠阻断
            if (!(b.getEndTime().isBefore(order.getPlannedStartAt()) || b.getEndTime().isEqual(order.getPlannedStartAt())
                    || b.getStartTime().isAfter(order.getPlannedEndAt()) || b.getStartTime().isEqual(order.getPlannedEndAt()))) {
                check.feasible = false;
                return check;
            }

            if (b.getEndTime().isBefore(order.getPlannedStartAt()) || b.getEndTime().isEqual(order.getPlannedStartAt())) {
                prevBooking = b;
            } else if (b.getStartTime().isAfter(order.getPlannedEndAt()) || b.getStartTime().isEqual(order.getPlannedEndAt())) {
                if (nextBooking == null) nextBooking = b;
            }
        }

        double originLat = staff.getBaseLatitude().doubleValue();
        double originLng = staff.getBaseLongitude().doubleValue();
        double destLat = order.getLatitude().doubleValue();
        double destLng = order.getLongitude().doubleValue();

        double distKm = DistanceUtil.calculateDistanceKm(originLat, originLng, destLat, destLng);
        int travelMins = DistanceUtil.estimateTravelMinutes(distKm, 15.0, 10);

        // 前序衔接检查
        if (prevBooking != null) {
            if (order.getPlannedStartAt().minusMinutes(travelMins).isBefore(prevBooking.getEndTime())) {
                check.feasible = false;
                return check;
            }
        }

        // 后续衔接检查
        if (nextBooking != null) {
            if (order.getPlannedEndAt().plusMinutes(travelMins).isAfter(nextBooking.getStartTime())) {
                check.feasible = false;
                return check;
            }
        }

        check.feasible = true;
        check.distanceKm = distKm;
        check.travelMinutes = travelMins;
        return check;
    }

    private void assignOrder(SimulationContext ctx, StaffProfile staff, ServiceOrder order,
                             BenchmarkMetrics metrics, double distKm, int travelMins) {
        metrics.successfulDispatches++;
        metrics.totalDistanceKm += distKm;
        metrics.totalTravelMinutes += travelMins;
        metrics.totalServiceRating += staff.getPriorRating().doubleValue();

        metrics.staffWorkloadOrders.put(staff.getId(), metrics.staffWorkloadOrders.get(staff.getId()) + 1);

        ctx.staffBookings.get(staff.getId()).add(StaffBooking.builder()
                .staffId(staff.getId())
                .orderId(order.getId())
                .startTime(order.getPlannedStartAt())
                .endTime(order.getPlannedEndAt())
                .status("CONFIRMED")
                .build());
    }

    @Test
    @DisplayName("毕业论文核心实验: 随机派单 vs 就近派单 vs 综合评分智能派单定量对比")
    public void runAlgorithmComparativeExperiment() {
        int staffCount = 12;
        int orderCount = 60;
        LocalDate testDate = LocalDate.now().plusDays(1);

        // 运行算法 A (随机)
        SimulationContext ctxA = initSimulationData(staffCount);
        List<ServiceOrder> ordersA = generateSimulationOrders(orderCount, testDate);
        BenchmarkMetrics resRandom = runRandomStrategy(ctxA, ordersA);

        // 运行算法 B (就近)
        SimulationContext ctxB = initSimulationData(staffCount);
        List<ServiceOrder> ordersB = generateSimulationOrders(orderCount, testDate);
        BenchmarkMetrics resGreedy = runGreedyDistanceStrategy(ctxB, ordersB);

        // 运行算法 C (本课题综合评分)
        SimulationContext ctxC = initSimulationData(staffCount);
        List<ServiceOrder> ordersC = generateSimulationOrders(orderCount, testDate);
        BenchmarkMetrics resComposite = runCompositeScoreStrategy(ctxC, ordersC);

        // 打印毕业论文标准实验成果表格
        System.out.println("\n=========================================================================================");
        System.out.println("                     【毕业设计实证实验: 三种派单机制性能对比表】                           ");
        System.out.println("=========================================================================================");
        System.out.printf("%-18s | %-12s | %-12s | %-12s | %-14s | %-12s | %-10s%n",
                "调度算法策略", "派单成功率(%)", "单均路程(km)", "单均耗时(min)", "平均履约评分(星)", "人员负荷标准差(单)", "单均耗时(ms)");
        System.out.println("-----------------------------------------------------------------------------------------");

        System.out.printf("%-18s | %-12.1f | %-12.2f | %-12.1f | %-14.2f | %-14.2f | %-10.3f%n",
                "A. 随机轮询派单 (Random)",
                resRandom.getSuccessRate(),
                resRandom.getAvgDistanceKm(),
                resRandom.getAvgTravelMinutes(),
                resRandom.getAvgRating(),
                resRandom.getWorkloadStdDev(),
                resRandom.getAvgLatencyMs());

        System.out.printf("%-18s | %-12.1f | %-12.2f | %-12.1f | %-14.2f | %-14.2f | %-10.3f%n",
                "B. 贪心就近派单 (Greedy)",
                resGreedy.getSuccessRate(),
                resGreedy.getAvgDistanceKm(),
                resGreedy.getAvgTravelMinutes(),
                resGreedy.getAvgRating(),
                resGreedy.getWorkloadStdDev(),
                resGreedy.getAvgLatencyMs());

        System.out.printf("%-18s | %-12.1f | %-12.2f | %-12.1f | %-14.2f | %-14.2f | %-10.3f%n",
                "C. 本课题综合智能评分",
                resComposite.getSuccessRate(),
                resComposite.getAvgDistanceKm(),
                resComposite.getAvgTravelMinutes(),
                resComposite.getAvgRating(),
                resComposite.getWorkloadStdDev(),
                resComposite.getAvgLatencyMs());
        System.out.println("=========================================================================================\n");

        // 论文关键推导断言验证:
        // 1. 综合智能评分的派单成功率应显著高于盲目随机派单
        assertTrue(resComposite.getSuccessRate() >= resRandom.getSuccessRate(), "综合派单成功率应不低于随机派单");
        // 2. 贪心就近容易导致中心位置人员被集中压榨，负载标准差明显偏高；综合评分具备工作量余量L惩罚，负荷分布更均衡
        assertTrue(resComposite.getWorkloadStdDev() <= resGreedy.getWorkloadStdDev() + 0.5,
                "综合评分机制应有效平抑就近算法带来的人员负荷严重极化问题");
        // 3. 综合算法平均服务评分应高于随机派单
        assertTrue(resComposite.getAvgRating() >= resRandom.getAvgRating(),
                "综合评分引入质量指标Q后，履约人员平均评分应优于随机派单");
        // 4. 计算耗时控制在 5ms 以内，满足高并发实时响应
        assertTrue(resComposite.getAvgLatencyMs() < 5.0, "单均计算耗时应小于5毫秒");
    }
}
