package com.agedcare.modules.order.dto;

import com.agedcare.modules.dispatch.entity.DispatchAttempt;
import com.agedcare.modules.elder.entity.ElderProfile;
import com.agedcare.modules.fulfillment.entity.ServiceRecord;
import com.agedcare.modules.fulfillment.entity.ServiceReview;
import com.agedcare.modules.order.entity.OrderStatusLog;
import com.agedcare.modules.order.entity.ServiceOrder;
import com.agedcare.modules.staff.dto.StaffDetailVO;
import lombok.Data;

import java.util.List;

@Data
public class OrderVO {
    private ServiceOrder order;
    private ElderProfile elder;
    private DispatchAttempt currentDispatch;
    private StaffDetailVO currentStaff;
    private ServiceRecord serviceRecord;
    private ServiceReview serviceReview;
    private List<OrderStatusLog> logs;
}
