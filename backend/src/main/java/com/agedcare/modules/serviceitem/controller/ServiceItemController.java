package com.agedcare.modules.serviceitem.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.security.RequireRole;
import com.agedcare.modules.serviceitem.entity.ServiceItem;
import com.agedcare.modules.serviceitem.service.ServiceItemService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "养老服务项目")
@RestController
@RequestMapping("/service-items")
@RequiredArgsConstructor
public class ServiceItemController {

    private final ServiceItemService serviceItemService;

    @Operation(summary = "查询上架中的服务项目列表(小程序/前端居民)")
    @GetMapping("/list-available")
    public Result<List<ServiceItem>> listAvailable(@RequestParam(required = false) String category) {
        return Result.success(serviceItemService.listOnShelfItems(category));
    }

    @Operation(summary = "分页查询全部服务项目(管理员)")
    @GetMapping("/page")
    @RequireRole(UserRole.ADMIN)
    public Result<Page<ServiceItem>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status
    ) {
        return Result.success(serviceItemService.pageItems(pageNum, pageSize, name, category, status));
    }

    @Operation(summary = "获取服务项目详情")
    @GetMapping("/{id}")
    public Result<ServiceItem> getById(@PathVariable Long id) {
        return Result.success(serviceItemService.getById(id));
    }

    @Operation(summary = "新增或编辑服务项目")
    @PostMapping("/save")
    @RequireRole(UserRole.ADMIN)
    public Result<ServiceItem> saveOrUpdate(@RequestBody ServiceItem item) {
        return Result.success(serviceItemService.saveOrUpdate(item));
    }

    @Operation(summary = "上架/下架切换")
    @PostMapping("/{id}/toggle-status")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> toggleStatus(@PathVariable Long id) {
        serviceItemService.toggleStatus(id);
        return Result.success();
    }
}
