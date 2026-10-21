package com.agedcare.modules.user.controller;

import com.agedcare.common.api.Result;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.security.RequireRole;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@org.springframework.validation.annotation.Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/operation-logs")
@RequireRole(UserRole.ADMIN)
public class OperationLogController {
    private final JdbcTemplate jdbc;
    @GetMapping("/page")
    public Result<Map<String, Object>> page(@RequestParam(defaultValue = "1") @jakarta.validation.constraints.Min(1) int pageNum, @RequestParam(defaultValue = "20") @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(100) int pageSize) {
        int size = Math.max(1, Math.min(100, pageSize));
        int page = Math.max(1, Math.min(100000, pageNum));
        return Result.success(Map.of("records", jdbc.queryForList("SELECT * FROM operation_log ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?", size, (page - 1) * size),
                "total", Objects.requireNonNullElse(jdbc.queryForObject("SELECT COUNT(*) FROM operation_log", Long.class), 0L)));
    }
}
