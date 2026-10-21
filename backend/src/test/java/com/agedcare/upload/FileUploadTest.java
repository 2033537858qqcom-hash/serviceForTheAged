package com.agedcare.upload;

import com.agedcare.common.api.Result;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.UserContext;
import com.agedcare.common.storage.CosService;
import com.agedcare.modules.upload.controller.FileUploadController;
import com.agedcare.modules.user.controller.UserController;
import com.agedcare.modules.user.dto.UserSummaryVO;
import com.agedcare.modules.user.entity.SysUser;
import com.agedcare.modules.user.mapper.SysUserMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class FileUploadTest {

    @TempDir
    Path tempDir;

    private CosService cosService;
    private FileUploadController fileUploadController;
    private SysUserMapper sysUserMapper;
    private PasswordEncoder passwordEncoder;
    private UserController userController;

    @BeforeEach
    void setUp() {
        cosService = new CosService();
        ReflectionTestUtils.setField(cosService, "secretId", "mock-test-secret-id");
        ReflectionTestUtils.setField(cosService, "secretKey", "mock-test-secret-key");
        ReflectionTestUtils.setField(cosService, "bucket", "shiyan-bbs-01-1429420924");
        ReflectionTestUtils.setField(cosService, "region", "ap-guangzhou");
        ReflectionTestUtils.setField(cosService, "fallbackDir", tempDir.toString());
        cosService.init();

        fileUploadController = new FileUploadController(cosService);

        sysUserMapper = mock(SysUserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        userController = new UserController(sysUserMapper, passwordEncoder);

        UserContext.setUser(LoginUser.builder()
                .id(1001L)
                .username("testresident")
                .realName("测试居民")
                .role("RESIDENT")
                .avatar("http://old-avatar.png")
                .build());
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
        cosService.destroy();
    }

    @Test
    void testUploadEmptyFileThrowsException() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]);
        assertThrows(BusinessException.class, () -> fileUploadController.uploadImage(emptyFile, "avatar"));
    }

    @Test
    void testUploadInvalidExtensionThrowsException() {
        MockMultipartFile txtFile = new MockMultipartFile("file", "test.txt", "text/plain", "hello".getBytes());
        assertThrows(BusinessException.class, () -> fileUploadController.uploadImage(txtFile, "avatar"));
    }

    @Test
    void testUploadAvatarSuccess() {
        MockMultipartFile validImage = new MockMultipartFile("file", "my-avatar.png", "image/png", new byte[]{1, 2, 3, 4});
        Result<Map<String, String>> result = fileUploadController.uploadImage(validImage, "avatar");
        assertNotNull(result);
        assertEquals(200, result.getCode());
        assertNotNull(result.getData());
        String url = result.getData().get("url");
        assertNotNull(url);
        assertTrue(url.contains("avatars") || url.contains("fallback"));
    }

    @Test
    void testUploadFulfillmentSuccess() {
        MockMultipartFile validImage = new MockMultipartFile("file", "done.jpg", "image/jpeg", new byte[]{10, 20, 30});
        Result<Map<String, String>> result = fileUploadController.uploadImage(validImage, "fulfillment");
        assertNotNull(result);
        assertEquals(200, result.getCode());
        assertNotNull(result.getData());
        String url = result.getData().get("url");
        assertNotNull(url);
        assertTrue(url.contains("fulfillment") || url.contains("fallback"));
    }

    @Test
    void testGetUserProfileAndAvatarUpdate() {
        SysUser user = SysUser.builder()
                .id(1001L)
                .username("testresident")
                .realName("测试居民")
                .phone("13800000000")
                .avatar("http://cos.myqcloud.com/old.jpg")
                .role("RESIDENT")
                .build();
        when(sysUserMapper.selectById(1001L)).thenReturn(user);

        Result<UserSummaryVO> profileResult = userController.getProfile();
        assertEquals(200, profileResult.getCode());
        assertEquals("http://cos.myqcloud.com/old.jpg", profileResult.getData().getAvatar());

        UserController.UpdateAvatarDTO dto = new UserController.UpdateAvatarDTO();
        dto.setAvatar("https://shiyan-bbs-01-1429420924.cos.ap-guangzhou.myqcloud.com/avatars/new.jpg");

        Result<String> avatarResult = userController.updateAvatar(dto);
        assertEquals(200, avatarResult.getCode());
        assertEquals(dto.getAvatar(), avatarResult.getData());
        verify(sysUserMapper, atLeastOnce()).updateById(any(SysUser.class));
    }
}
