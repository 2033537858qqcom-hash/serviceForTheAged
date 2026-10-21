package com.agedcare.modules.auth.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.modules.auth.dto.AuthResponse;
import com.agedcare.modules.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Profile({"dev", "test"})
@Tag(name = "演示环境模拟鉴权中心")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class MockAuthController {

    private final AuthService authService;

    @Value("${app.dev-mode:false}")
    private boolean devMode;

    @Operation(summary = "演示环境一键切换角色登录 (仅限开发与测试环境)")
    @PostMapping("/mock-login")
    public Result<AuthResponse> mockLogin(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String username
    ) {
        if (!devMode) {
            throw new BusinessException(403, "当前运行环境已禁用模拟演示切换登录");
        }
        return Result.success(authService.mockLogin(role, username));
    }
}
