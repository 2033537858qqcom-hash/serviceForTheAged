package com.agedcare.user;

import com.agedcare.modules.user.controller.OperationLogController;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OperationLogControllerTest {
    @Test
    void defaultPageExcludesSystemCleanupRows() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);
        new OperationLogController(jdbc).page(1, 20, false);
        verify(jdbc).queryForList(contains("NOT (operator_name = 'SYSTEM' AND action LIKE 'LEGACY"), any(Object[].class));
        verify(jdbc).queryForObject(contains("NOT (operator_name = 'SYSTEM'"), eq(Long.class));
    }

    @Test
    void includeSystemReturnsAllRows() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of("action", "LEGACY_PHOTO_PENDING")));
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(1L);
        var result = new OperationLogController(jdbc).page(1, 20, true);
        verify(jdbc).queryForList(argThat((String sql) -> !sql.contains("WHERE")), any(Object[].class));
        assertEquals(1L, result.getData().get("total"));
    }
}
