package com.agedcare.modules.order.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("service_order")
public class ServiceOrder implements Serializable {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String orderNo;
    private Long requesterUserId;
    private Long elderId;
    private Long serviceItemId;
    private String serviceNameSnapshot;
    private String serviceDescriptionSnapshot;
    private String requiredSkillsSnapshot;
    private BigDecimal priceSnapshot;
    private Integer durationMinutesSnapshot;
    private LocalDateTime plannedStartAt;
    private LocalDateTime plannedEndAt;
    private String addressSnapshot;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private String coordinateType;
    private String contactNameSnapshot;
    private String contactPhoneSnapshot;
    private String remark;
    private String status; // WAIT_DISPATCH, WAIT_ACCEPT, WAIT_VISIT, IN_SERVICE, WAIT_CONFIRM, COMPLETED, WAIT_MANUAL, CANCELLED

    @com.baomidou.mybatisplus.annotation.TableField(updateStrategy = com.baomidou.mybatisplus.annotation.FieldStrategy.ALWAYS)
    private Long currentDispatchId;
    private Integer dispatchRound;
    private String idempotencyKey;
    private String requestDigest;
    private String cancelReason;
    private LocalDateTime cancelledAt;
    private Long confirmedByUserId;
    private LocalDateTime confirmedAt;

    @Version
    private Integer version;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public com.agedcare.common.enums.OrderStatus getStatusEnum() {
        if (this.status == null) return null;
        try {
            return com.agedcare.common.enums.OrderStatus.valueOf(this.status);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
