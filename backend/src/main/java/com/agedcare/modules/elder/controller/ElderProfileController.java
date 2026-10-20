package com.agedcare.modules.elder.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.security.RequireRole;
import com.agedcare.modules.elder.entity.ElderProfile;
import com.agedcare.modules.elder.service.ElderProfileService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "老人档案管理")
@RestController
@RequestMapping("/elders")
@RequiredArgsConstructor
public class ElderProfileController {

    private final ElderProfileService elderProfileService;

    @Operation(summary = "分页查询老人档案列表(管理员)")
    @GetMapping("/page")
    @RequireRole(UserRole.ADMIN)
    public Result<Page<ElderProfile>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String community
    ) {
        return Result.success(elderProfileService.pageElders(pageNum, pageSize, name, community));
    }

    @Operation(summary = "获取当前用户可访问的老人列表(本人及已授权家属)")
    @GetMapping("/my-list")
    public Result<List<ElderProfile>> getAccessibleElders() {
        return Result.success(elderProfileService.getAccessibleElders());
    }

    @Operation(summary = "根据ID获取老人档案详情")
    @GetMapping("/{id}")
    public Result<ElderProfile> getById(@PathVariable Long id) {
        return Result.success(elderProfileService.getById(id));
    }

    @Operation(summary = "新增或编辑老人档案")
    @PostMapping("/save")
    public Result<ElderProfile> saveOrUpdate(@RequestBody ElderProfile profile) {
        return Result.success(elderProfileService.saveOrUpdate(profile));
    }
}
