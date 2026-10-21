package com.agedcare.common.storage;

import com.agedcare.common.exception.BusinessException;
import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.model.ObjectMetadata;
import com.qcloud.cos.model.PutObjectRequest;
import com.qcloud.cos.region.Region;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class CosService {

    @Value("${tencent.cos.secret-id:}")
    private String secretId;

    @Value("${tencent.cos.secret-key:}")
    private String secretKey;

    @Value("${tencent.cos.bucket:}")
    private String bucket;

    @Value("${tencent.cos.region:ap-guangzhou}")
    private String region;

    @Value("${tencent.cos.domain:}")
    private String customDomain;

    @Value("${app.upload-fallback-dir:./uploads/fallback}")
    private String fallbackDir;

    private COSClient cosClient;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");

    @PostConstruct
    public void init() {
        if (StringUtils.hasText(secretId) && StringUtils.hasText(secretKey)) {
            try {
                COSCredentials cred = new BasicCOSCredentials(secretId, secretKey);
                ClientConfig clientConfig = new ClientConfig(new Region(region));
                this.cosClient = new COSClient(cred, clientConfig);
                log.info("腾讯云 COS 客户端初始化成功，存储桶: {}, 区域: {}", bucket, region);
            } catch (Exception e) {
                log.warn("腾讯云 COS 客户端初始化失败，将使用本地降级存储: {}", e.getMessage());
            }
        } else {
            log.warn("未检测到腾讯云 COS 凭据，文件上传将降级为本地存储模式");
        }
    }

    @PreDestroy
    public void destroy() {
        if (cosClient != null) {
            try {
                cosClient.shutdown();
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * 上传图片到腾讯云 COS，返回可访问的完整 URL
     *
     * @param file   前端上传的 Multipart 文件
     * @param subDir 子目录路径，如 "avatars" 或 "fulfillment"
     * @return 文件的网络 URL
     */
    public String uploadImage(MultipartFile file, String subDir) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("上传的文件不能为空");
        }

        // 文件大小限制: 10MB
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new BusinessException("上传图片大小不能超过 10MB");
        }

        String originalFilename = file.getOriginalFilename();
        String ext = getFileExtension(originalFilename);
        if (!ALLOWED_EXTENSIONS.contains(ext.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("仅支持 JPG、PNG、WEBP 或 GIF 格式图片");
        }

        String dateFolder = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String cleanSubDir = StringUtils.hasText(subDir) ? subDir.replaceAll("[^a-zA-Z0-9_-]", "") : "images";
        String objectKey = cleanSubDir + "/" + dateFolder + "/" + UUID.randomUUID().toString().replace("-", "") + ext;

        if (cosClient != null && StringUtils.hasText(bucket)) {
            try (InputStream in = file.getInputStream()) {
                ObjectMetadata metadata = new ObjectMetadata();
                metadata.setContentLength(file.getSize());
                if (file.getContentType() != null) {
                    metadata.setContentType(file.getContentType());
                }

                PutObjectRequest putObjectRequest = new PutObjectRequest(bucket, objectKey, in, metadata);
                cosClient.putObject(putObjectRequest);

                if (StringUtils.hasText(customDomain)) {
                    String domain = customDomain.endsWith("/") ? customDomain.substring(0, customDomain.length() - 1) : customDomain;
                    return domain + "/" + objectKey;
                }

                return "https://" + bucket + ".cos." + region + ".myqcloud.com/" + objectKey;
            } catch (Exception e) {
                log.error("上传至腾讯云 COS 异常，尝试本地降级存储: {}", e.getMessage(), e);
            }
        }

        // 本地降级存储兜底（离线/单元测试/网络异常时保障业务不中断）
        return saveToLocalFallback(file, objectKey);
    }

    private String saveToLocalFallback(MultipartFile file, String objectKey) {
        try {
            Path targetDir = Path.of(fallbackDir).toAbsolutePath().normalize();
            Path targetFile = targetDir.resolve(objectKey);
            Files.createDirectories(targetFile.getParent());
            file.transferTo(targetFile.toFile());
            return "/media/fallback/" + objectKey;
        } catch (IOException e) {
            log.error("本地降级保存文件失败: {}", e.getMessage(), e);
            throw new BusinessException("图片上传失败，请稍后重试");
        }
    }

    private String getFileExtension(String filename) {
        if (!StringUtils.hasText(filename) || !filename.contains(".")) {
            return ".jpg";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}
