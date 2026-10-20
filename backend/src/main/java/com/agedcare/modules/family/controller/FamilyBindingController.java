package com.agedcare.modules.family.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.security.RequireRole;
import com.agedcare.modules.family.dto.FamilyBindingVO;
import com.agedcare.modules.family.entity.FamilyBinding;
import com.agedcare.modules.family.service.FamilyBindingService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "家属绑定与授权")
@RestController
@RequestMapping("/family-bindings")
@RequiredArgsConstructor
public class FamilyBindingController {

    private final FamilyBindingService familyBindingService;

    @Data
    public static class ApplyDTO {
        private Long elderId;
        private String relation;
        private String proofMaterials;
    }

    @Data
    public static class AuditDTO {
        private Long bindingId;
        private boolean approve;
        private String reason;
    }

    @Operation(summary = "提交家属代约/监护绑定申请")
    @PostMapping("/apply")
    public Result<FamilyBinding> apply(@RequestBody ApplyDTO dto) {
        return Result.success(familyBindingService.applyBinding(dto.getElderId(), dto.getRelation(), dto.getProofMaterials()));
    }

    @Operation(summary = "查询我的家属绑定列表")
    @GetMapping("/my-bindings")
    public Result<List<FamilyBindingVO>> getMyBindings() {
        return Result.success(familyBindingService.getMyBindings());
    }

    @Operation(summary = "分页查询绑定申请列表(管理员)")
    @GetMapping("/page")
    @RequireRole(UserRole.ADMIN)
    public Result<Page<FamilyBindingVO>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String status
    ) {
        return Result.success(familyBindingService.pageBindings(pageNum, pageSize, status));
    }

    @Operation(summary = "管理员审核绑定申请")
    @PostMapping("/audit")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> audit(@RequestBody AuditDTO dto) {
        familyBindingService.auditBinding(dto.getBindingId(), dto.isApprove(), dto.getReason());
        return Result.success();
    }

    @Operation(summary = "撤销家属绑定")
    @PostMapping("/{id}/revoke")
    public Result<Void> revoke(@PathVariable Long id) {
        familyBindingService.revokeBinding(id);
        return Result.success();
    }
}
