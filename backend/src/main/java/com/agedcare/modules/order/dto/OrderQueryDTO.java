package com.agedcare.modules.order.dto;

import lombok.Data;

@Data
public class OrderQueryDTO {
    @jakarta.validation.constraints.Min(1) private int pageNum = 1;
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(100) private int pageSize = 10;
    private String orderNo;
    private String status;
    private Long elderId;
    private Long staffId;
}
