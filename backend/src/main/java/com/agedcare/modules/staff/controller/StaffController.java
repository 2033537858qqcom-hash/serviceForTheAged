package com.agedcare.modules.staff.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.security.RequireRole;
import com.agedcare.modules.staff.dto.StaffDetailVO;
import com.agedcare.modules.staff.entity.StaffShift;
import com.agedcare.modules.staff.service.StaffService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "服务人员与排班管理")
@RestController
@RequestMapping("/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    @Data
    public static class AuditStaffDTO {
        private Long staffId;
        private boolean approve;
        private String reason;
    }

    @Data
    public static class AddSkillDTO {
        private Long staffId;
        private String skillCode;
        private String skillName;
        private String certificateNo;
    }

    @Operation(summary = "分页查询服务人员(管理员)")
    @GetMapping("/page")
    @RequireRole(UserRole.ADMIN)
    public Result<Page<StaffDetailVO>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String auditStatus,
            @RequestParam(required = false) String currentStatus
    ) {
        return Result.success(staffService.pageStaff(pageNum, pageSize, name, auditStatus, currentStatus));
    }

    @Operation(summary = "获取服务人员详情")
    @GetMapping("/{id}")
    public Result<StaffDetailVO> getDetail(@PathVariable Long id) {
        return Result.success(staffService.getStaffDetail(id));
    }

    @Operation(summary = "服务人员获取本人工位档案")
    @GetMapping("/my-profile")
    public Result<StaffDetailVO> getMyProfile() {
        return Result.success(staffService.getMyStaffProfile());
    }

    @Operation(summary = "修改服务人员工作状态(RESTING, AVAILABLE, BUSY)")
    @PostMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam String status) {
        staffService.updateStaffStatus(id, status);
        return Result.success();
    }

    @Operation(summary = "管理员审核服务人员")
    @PostMapping("/audit")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> audit(@RequestBody AuditStaffDTO dto) {
        staffService.auditStaff(dto.getStaffId(), dto.isApprove(), dto.getReason());
        return Result.success();
    }

    @Operation(summary = "录入人员技能资质")
    @PostMapping("/skill/add")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> addSkill(@RequestBody AddSkillDTO dto) {
        staffService.addSkill(dto.getStaffId(), dto.getSkillCode(), dto.getSkillName(), dto.getCertificateNo());
        return Result.success();
    }

    @Operation(summary = "删除人员技能")
    @DeleteMapping("/skill/{skillId}")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> removeSkill(@PathVariable Long skillId) {
        staffService.removeSkill(skillId);
        return Result.success();
    }

    @Operation(summary = "录入排班班次")
    @PostMapping("/shift/add")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> addShift(@RequestBody StaffShift shift) {
        staffService.addShift(shift);
        return Result.success();
    }

    @Operation(summary = "查询服务人员指定日期范围排班")
    @GetMapping("/{id}/shifts")
    public Result<List<StaffShift>> getShifts(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return Result.success(staffService.getStaffShifts(id, startDate, endDate));
    }
}
