package com.agedcare.modules.user.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.RequireRole;
import com.agedcare.common.security.UserContext;
import com.agedcare.modules.user.entity.SysUser;
import com.agedcare.modules.user.mapper.SysUserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@Tag(name = "系统用户管理")
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final SysUserMapper sysUserMapper;
    private final PasswordEncoder passwordEncoder;

    @Data
    public static class UpdatePwdDTO {
        private String oldPassword;
        private String newPassword;
    }

    @Operation(summary = "分页查询系统用户(管理员)")
    @GetMapping("/page")
    @RequireRole(UserRole.ADMIN)
    public Result<Page<SysUser>> page(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String role
    ) {
        Page<SysUser> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(username)) {
            wrapper.like(SysUser::getUsername, username).or().like(SysUser::getRealName, username);
        }
        if (StringUtils.hasText(role)) {
            wrapper.eq(SysUser::getRole, role);
        }
        wrapper.orderByDesc(SysUser::getCreatedAt);
        return Result.success(sysUserMapper.selectPage(page, wrapper));
    }

    @Operation(summary = "启用/停用用户账号")
    @PostMapping("/{id}/status")
    @RequireRole(UserRole.ADMIN)
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        SysUser user = sysUserMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        user.setStatus(status);
        user.setUpdatedAt(LocalDateTime.now());
        sysUserMapper.updateById(user);
        return Result.success();
    }

    @Operation(summary = "修改个人登录密码")
    @PostMapping("/update-password")
    public Result<Void> updatePassword(@RequestBody UpdatePwdDTO dto) {
        LoginUser currentUser = UserContext.getUser();
        SysUser user = sysUserMapper.selectById(currentUser.getId());
        if (!passwordEncoder.matches(dto.getOldPassword(), user.getPassword())) {
            throw new BusinessException("旧密码不正确");
        }
        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        sysUserMapper.updateById(user);
        return Result.success();
    }
}
