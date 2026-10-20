package com.agedcare.modules.order.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class OrderCreateDTO {
    @NotNull(message = "服务对象老人ID不能为空")
    private Long elderId;

    @NotNull(message = "服务项目ID不能为空")
    private Long serviceItemId;

    @NotNull(message = "预约开始时间不能为空")
    @Future(message = "预约时间必须为未来时间")
    private LocalDateTime plannedStartAt;

    @NotBlank(message = "服务地址不能为空")
    private String address;

    private BigDecimal longitude;
    private BigDecimal latitude;
    private String coordinateType;

    @NotBlank(message = "联系人姓名不能为空")
    private String contactName;

    @NotBlank(message = "联系人电话不能为空")
    private String contactPhone;

    private String remark;

    /**
     * 客户端防重复提交幂等键(如UUID)
     */
    private String idempotencyKey;
}
