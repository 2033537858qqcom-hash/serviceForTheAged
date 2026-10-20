package com.agedcare.modules.order.dto;

import lombok.Data;

@Data
public class OrderQueryDTO {
    private int pageNum = 1;
    private int pageSize = 10;
    private String orderNo;
    private String status;
    private Long elderId;
    private Long staffId;
}
