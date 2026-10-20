package com.agedcare.modules.order.mapper;

import com.agedcare.modules.order.entity.ServiceOrder;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ServiceOrderMapper extends BaseMapper<ServiceOrder> {

    @Select("SELECT * FROM service_order WHERE id = #{id} FOR UPDATE")
    ServiceOrder selectByIdForUpdate(@Param("id") Long id);
}
