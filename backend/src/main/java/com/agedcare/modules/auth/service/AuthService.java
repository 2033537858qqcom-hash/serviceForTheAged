package com.agedcare.modules.auth.service;

import com.agedcare.common.api.ResultCode;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.JwtTokenProvider;
import com.agedcare.common.security.LoginUser;
import com.agedcare.modules.auth.dto.AuthResponse;
import com.agedcare.modules.auth.dto.LoginRequest;
import com.agedcare.modules.auth.dto.RegisterRequest;
import com.agedcare.modules.auth.dto.WechatLoginRequest;
import com.agedcare.modules.user.entity.SysUser;
import com.agedcare.modules.user.mapper.SysUserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;

    @Value("${wechat.miniapp.appid:}")
    private String wechatAppId;

    @Value("${wechat.miniapp.secret:}")
    private String wechatSecret;

    private final OkHttpClient httpClient = new OkHttpClient();

    public AuthResponse login(LoginRequest req) {
        SysUser user = userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, req.getUsername())
                .or()
                .eq(SysUser::getPhone, req.getUsername()));

        if (user == null) {
            throw new BusinessException("账号或手机号不存在");
        }

        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException("该账号已被管理员停用，请联系社区工作人员");
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new BusinessException("密码错误，请重新输入");
        }

        return createAuthResponse(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public AuthResponse register(RegisterRequest req) {
        Long countUsername = userMapper.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, req.getUsername()));
        if (countUsername > 0) {
            throw new BusinessException("用户名已被占用");
        }

        Long countPhone = userMapper.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getPhone, req.getPhone()));
        if (countPhone > 0) {
            throw new BusinessException("手机号已被注册");
        }

        String role = StringUtils.hasText(req.getRole()) ? req.getRole().toUpperCase() : UserRole.RESIDENT.getCode();

        SysUser newUser = SysUser.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .realName(req.getRealName())
                .phone(req.getPhone())
                .role(role)
                .status(1)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        userMapper.insert(newUser);
        return createAuthResponse(newUser);
    }

    public AuthResponse mockLogin(String role, String username) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<SysUser>();
        if (StringUtils.hasText(username)) {
            wrapper.eq(SysUser::getUsername, username);
        } else if (StringUtils.hasText(role)) {
            wrapper.eq(SysUser::getRole, role.toUpperCase()).last("LIMIT 1");
        } else {
            wrapper.eq(SysUser::getUsername, "admin");
        }

        SysUser user = userMapper.selectOne(wrapper);
        if (user == null) {
            throw new BusinessException("未找到对应的演示测试账号");
        }

        return createAuthResponse(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public AuthResponse wechatLogin(WechatLoginRequest req) {
        String openid = fetchWechatOpenid(req.getCode());
        if (!StringUtils.hasText(openid)) {
            throw new BusinessException("获取微信 OpenID 失败，请检查微信配置或 Code 有效性");
        }

        SysUser user = userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getOpenid, openid));

        if (user == null) {
            // 首次微信进入，自动注册为居民账号
            String role = StringUtils.hasText(req.getRole()) ? req.getRole().toUpperCase() : UserRole.RESIDENT.getCode();
            String generatedUsername = "wx_" + openid.substring(Math.max(0, openid.length() - 8));
            String nickName = StringUtils.hasText(req.getNickName()) ? req.getNickName() : "微信居民用户";

            user = SysUser.builder()
                    .username(generatedUsername)
                    .password(passwordEncoder.encode("123456"))
                    .realName(nickName)
                    .phone("")
                    .avatar(req.getAvatarUrl() != null ? req.getAvatarUrl() : "")
                    .role(role)
                    .openid(openid)
                    .status(1)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            userMapper.insert(user);
        }

        return createAuthResponse(user);
    }

    private String fetchWechatOpenid(String code) {
        if (!StringUtils.hasText(wechatAppId) || !StringUtils.hasText(wechatSecret)) {
            log.warn("微信 AppID 或 Secret 未配置，生成模拟 openid 用于联调");
            return "mock_openid_" + code;
        }

        String url = String.format(
                "https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
                wechatAppId, wechatSecret, code
        );

        Request request = new Request.Builder().url(url).get().build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (response.isSuccessful() && response.body() != null) {
                String responseBody = response.body().string();
                JsonNode jsonNode = objectMapper.readTree(responseBody);
                if (jsonNode.has("openid")) {
                    return jsonNode.get("openid").asText();
                } else {
                    log.error("微信返回错误: {}", responseBody);
                }
            }
        } catch (IOException e) {
            log.error("调用微信 jscode2session 接口异常", e);
        }
        return null;
    }

    private AuthResponse createAuthResponse(SysUser user) {
        LoginUser loginUser = LoginUser.builder()
                .id(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .phone(user.getPhone())
                .role(user.getRole())
                .openid(user.getOpenid())
                .build();

        String token = jwtTokenProvider.generateToken(loginUser);
        return AuthResponse.builder()
                .token(token)
                .userInfo(loginUser)
                .build();
    }
}
