package com.agedcare.modules.staff.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("staff_shift")
public class StaffShift implements Serializable {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long staffId;
    private LocalDate shiftDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private String status; // ACTIVE, CANCELLED
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
