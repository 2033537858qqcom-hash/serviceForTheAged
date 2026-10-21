package com.agedcare.modules.fulfillment.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.security.RequireRole;
import com.agedcare.modules.fulfillment.entity.ServiceComplaint;
import com.agedcare.modules.fulfillment.entity.ServiceRecord;
import com.agedcare.modules.fulfillment.entity.ServiceReview;
import com.agedcare.modules.fulfillment.service.FulfillmentService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "履约跟踪、确认与评价")
@RestController
@RequestMapping("/fulfillment")
@RequiredArgsConstructor
public class FulfillmentController {

    private final FulfillmentService fulfillmentService;

    @Data
    public static class ConfirmDTO {
        private Long orderId;
        private String note;
    }

    @Data
    public static class HandleComplaintDTO {
        private Long id;
        private String result;
    }

    @Operation(summary = "服务人员开始上门服务(签到)")
    @PostMapping("/start/{orderId}")
    @RequireRole(UserRole.STAFF)
    public Result<Void> startService(@PathVariable Long orderId) {
        fulfillmentService.startService(orderId);
        return Result.success();
    }

    @Operation(summary = "服务人员提交上门履约记录")
    @PostMapping("/submit-record")
    @RequireRole(UserRole.STAFF)
    public Result<Void> submitRecord(@RequestBody ServiceRecord record) {
        fulfillmentService.submitServiceRecord(record);
        return Result.success();
    }

    @Operation(summary = "确认服务完成(老人、家属或管理员核实代办)")
    @PostMapping("/confirm")
    @RequireRole({UserRole.RESIDENT, UserRole.ADMIN})
    public Result<Void> confirm(@RequestBody ConfirmDTO dto) {
        fulfillmentService.confirmOrder(dto.getOrderId(), dto.getNote());
        return Result.success();
    }

    @Operation(summary = "提交服务评价(仅限居民)")
    @PostMapping("/review")
    @RequireRole(UserRole.RESIDENT)
    public Result<Void> submitReview(@RequestBody ServiceReview review) {
        fulfillmentService.submitReview(review);
        return Result.success();
    }

    @Operation(summary = "提交服务投诉或建议(仅限订单关联居民)")
    @PostMapping("/complaint")
    @RequireRole(UserRole.RESIDENT)
    public Result<Void> submitComplaint(@RequestBody ServiceComplaint complaint) {
        fulfillmentService.submitComplaint(complaint);
        return Result.success();
    }

    @Operation(summary = "分页查询投诉列表(管理员)")
    @GetMapping("/complaints/page")
    @RequireRole(UserRole.ADMIN)
    public Result<Page<ServiceComplaint>> pageComplaints(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String status
    ) {
        return Result.success(fulfillmentService.pageComplaints(pageNum, pageSize, status));
    }

    @Operation(summary = "管理员处理投诉")
    @PostMapping("/complaint/handle")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> handleComplaint(@RequestBody HandleComplaintDTO dto) {
        fulfillmentService.handleComplaint(dto.getId(), dto.getResult());
        return Result.success();
    }
}
