package com.agedcare.modules.fulfillment.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("service_complaint")
public class ServiceComplaint implements Serializable {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long orderId;
    private Long complainantId;
    private String complaintTitle;
    private String complaintContent;
    private String status; // PENDING, PROCESSING, RESOLVED, REJECTED
    private Long handleUserId;
    private String handleResult;
    private LocalDateTime handledAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
