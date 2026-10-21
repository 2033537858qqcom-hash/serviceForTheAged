package com.agedcare.modules.upload.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.storage.CosService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Tag(name = "通用文件与图片上传")
@RestController
@RequestMapping("/upload")
@RequiredArgsConstructor
public class FileUploadController {

    private final CosService cosService;

    @Operation(summary = "上传图片到腾讯云COS对象存储")
    @PostMapping("/image")
    public Result<Map<String, String>> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "type", defaultValue = "general") String type
    ) {
        String subDir = switch (type.toLowerCase()) {
            case "avatar" -> "avatars";
            case "fulfillment", "record" -> "fulfillment";
            case "service" -> "services";
            default -> "images";
        };

        String url = cosService.uploadImage(file, subDir);
        return Result.success(Map.of("url", url));
    }
}
