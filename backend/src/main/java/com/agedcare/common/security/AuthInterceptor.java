package com.agedcare.common.security;

import com.agedcare.common.api.ResultCode;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Arrays;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        String authHeader = request.getHeader("Authorization");
        String token = null;
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }

        LoginUser user = null;
        if (StringUtils.hasText(token)) {
            user = jwtTokenProvider.parseToken(token);
        }

        if (user != null) {
            UserContext.setUser(user);
        }

        // 检查方法或类上的角色注解
        RequireRole requireRole = handlerMethod.getMethodAnnotation(RequireRole.class);
        if (requireRole == null) {
            requireRole = handlerMethod.getBeanType().getAnnotation(RequireRole.class);
        }

        if (requireRole != null) {
            if (user == null) {
                throw new BusinessException(ResultCode.UNAUTHORIZED);
            }
            UserRole[] allowedRoles = requireRole.value();
            if (allowedRoles.length > 0) {
                final String userRole = user.getRole();
                boolean hasPermission = Arrays.stream(allowedRoles)
                        .anyMatch(r -> r.getCode().equalsIgnoreCase(userRole));
                if (!hasPermission) {
                    throw new BusinessException(ResultCode.FORBIDDEN);
                }
            }
        }

        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
    }
}
