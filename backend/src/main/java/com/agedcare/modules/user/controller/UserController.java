package com.agedcare.modules.user.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.RequireRole;
import com.agedcare.common.security.UserContext;
import com.agedcare.modules.user.dto.UserSummaryVO;
import com.agedcare.modules.user.entity.SysUser;
import com.agedcare.modules.user.mapper.SysUserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
        @NotBlank(message = "旧密码不能为空")
        private String oldPassword;

        @NotBlank(message = "新密码不能为空")
        @Size(min = 6, max = 32, message = "新密码长度必须在6至32位之间")
        private String newPassword;
    }

    @Data
    public static class UpdateAvatarDTO {
        @NotBlank(message = "头像URL不能为空")
        private String avatar;
    }

    @Data
    public static class UpdateProfileDTO {
        @Size(max = 32, message = "姓名长度不能超过32位")
        private String realName;
        private String avatar;
    }

    public static boolean isValidImageUrl(String url) {
        if (!StringUtils.hasText(url)) return false;
        String trimmed = url.trim();
        return (trimmed.startsWith("https://") && (trimmed.contains(".myqcloud.com/") || trimmed.contains(".cos.")))
                || trimmed.startsWith("/media/")
                || ((trimmed.startsWith("http://") || trimmed.startsWith("https://")) && trimmed.contains("/media/"));
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
    public Result<Void> updatePassword(@Valid @RequestBody UpdatePwdDTO dto) {
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

    @Operation(summary = "获取当前登录用户的个人资料")
    @GetMapping("/profile")
    public Result<UserSummaryVO> getProfile() {
        LoginUser currentUser = UserContext.getUser();
        SysUser user = sysUserMapper.selectById(currentUser.getId());
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        return Result.success(UserSummaryVO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .phone(user.getPhone())
                .avatar(user.getAvatar())
                .role(user.getRole())
                .build());
    }

    @Operation(summary = "修改当前登录用户的个人头像")
    @PostMapping("/avatar")
    public Result<String> updateAvatar(@Valid @RequestBody UpdateAvatarDTO dto) {
        if (!isValidImageUrl(dto.getAvatar())) {
            throw new BusinessException("头像图片地址格式不合法，仅支持本系统及受信任的存储源");
        }
        LoginUser currentUser = UserContext.getUser();
        SysUser user = sysUserMapper.selectById(currentUser.getId());
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        user.setAvatar(dto.getAvatar().trim());
        user.setUpdatedAt(LocalDateTime.now());
        sysUserMapper.updateById(user);
        return Result.success(user.getAvatar());
    }

    @Operation(summary = "修改当前登录用户的个人资料")
    @PutMapping("/profile")
    public Result<UserSummaryVO> updateProfile(@Valid @RequestBody UpdateProfileDTO dto) {
        LoginUser currentUser = UserContext.getUser();
        SysUser user = sysUserMapper.selectById(currentUser.getId());
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        if (StringUtils.hasText(dto.getRealName())) {
            user.setRealName(dto.getRealName().trim());
        }
        if (StringUtils.hasText(dto.getAvatar())) {
            if (!isValidImageUrl(dto.getAvatar())) {
                throw new BusinessException("头像图片地址格式不合法，仅支持本系统及受信任的存储源");
            }
            user.setAvatar(dto.getAvatar().trim());
        }
        user.setUpdatedAt(LocalDateTime.now());
        sysUserMapper.updateById(user);
        return Result.success(UserSummaryVO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .phone(user.getPhone())
                .avatar(user.getAvatar())
                .role(user.getRole())
                .build());
    }
}
