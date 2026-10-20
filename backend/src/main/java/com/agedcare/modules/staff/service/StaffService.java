package com.agedcare.modules.staff.service;

import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.UserContext;
import com.agedcare.modules.staff.dto.StaffDetailVO;
import com.agedcare.modules.staff.entity.StaffProfile;
import com.agedcare.modules.staff.entity.StaffShift;
import com.agedcare.modules.staff.entity.StaffSkill;
import com.agedcare.modules.staff.mapper.StaffProfileMapper;
import com.agedcare.modules.staff.mapper.StaffShiftMapper;
import com.agedcare.modules.staff.mapper.StaffSkillMapper;
import com.agedcare.modules.user.entity.SysUser;
import com.agedcare.modules.user.mapper.SysUserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StaffService {

    private final StaffProfileMapper staffProfileMapper;
    private final StaffSkillMapper staffSkillMapper;
    private final StaffShiftMapper staffShiftMapper;
    private final SysUserMapper sysUserMapper;

    public Page<StaffDetailVO> pageStaff(int pageNum, int pageSize, String name, String auditStatus, String currentStatus) {
        Page<StaffProfile> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<StaffProfile> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(auditStatus)) {
            wrapper.eq(StaffProfile::getAuditStatus, auditStatus);
        }
        if (StringUtils.hasText(currentStatus)) {
            wrapper.eq(StaffProfile::getCurrentStatus, currentStatus);
        }
        wrapper.orderByDesc(StaffProfile::getCreatedAt);

        Page<StaffProfile> profilePage = staffProfileMapper.selectPage(page, wrapper);
        List<StaffDetailVO> voList = profilePage.getRecords().stream()
                .map(this::assembleStaffDetail)
                .filter(vo -> {
                    if (StringUtils.hasText(name)) {
                        return vo.getUser() != null && vo.getUser().getRealName().contains(name);
                    }
                    return true;
                })
                .collect(Collectors.toList());

        Page<StaffDetailVO> resultPage = new Page<>(profilePage.getCurrent(), profilePage.getSize(), profilePage.getTotal());
        resultPage.setRecords(voList);
        return resultPage;
    }

    public StaffDetailVO getStaffDetail(Long staffId) {
        StaffProfile profile = staffProfileMapper.selectById(staffId);
        if (profile == null) {
            throw new BusinessException("服务人员档案不存在");
        }
        return assembleStaffDetail(profile);
    }

    public StaffDetailVO getMyStaffProfile() {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException("未登录");
        }
        StaffProfile profile = staffProfileMapper.selectOne(new LambdaQueryWrapper<StaffProfile>()
                .eq(StaffProfile::getUserId, currentUser.getId()));
        if (profile == null) {
            throw new BusinessException("未找到当前账号对应的服务人员档案");
        }
        return assembleStaffDetail(profile);
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateStaffStatus(Long staffId, String status) {
        StaffProfile profile = staffProfileMapper.selectById(staffId);
        if (profile == null) {
            throw new BusinessException("人员不存在");
        }
        profile.setCurrentStatus(status);
        profile.setUpdatedAt(LocalDateTime.now());
        staffProfileMapper.updateById(profile);
    }

    @Transactional(rollbackFor = Exception.class)
    public void auditStaff(Long staffId, boolean approve, String reason) {
        StaffProfile profile = staffProfileMapper.selectById(staffId);
        if (profile == null) {
            throw new BusinessException("人员不存在");
        }
        profile.setAuditStatus(approve ? "APPROVED" : "REJECTED");
        profile.setAuditReason(reason != null ? reason : "");
        profile.setAuditTime(LocalDateTime.now());
        profile.setUpdatedAt(LocalDateTime.now());
        staffProfileMapper.updateById(profile);
    }

    @Transactional(rollbackFor = Exception.class)
    public void addSkill(Long staffId, String skillCode, String skillName, String certificateNo) {
        Long count = staffSkillMapper.selectCount(new LambdaQueryWrapper<StaffSkill>()
                .eq(StaffSkill::getStaffId, staffId)
                .eq(StaffSkill::getSkillCode, skillCode));
        if (count > 0) {
            throw new BusinessException("该服务人员已具备该技能");
        }

        StaffSkill skill = StaffSkill.builder()
                .staffId(staffId)
                .skillCode(skillCode)
                .skillName(skillName)
                .certificateNo(certificateNo != null ? certificateNo : "")
                .auditStatus("APPROVED")
                .createdAt(LocalDateTime.now())
                .build();
        staffSkillMapper.insert(skill);
    }

    @Transactional(rollbackFor = Exception.class)
    public void removeSkill(Long skillId) {
        staffSkillMapper.deleteById(skillId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void addShift(StaffShift shift) {
        if (shift.getEndTime().isBefore(shift.getStartTime())) {
            throw new BusinessException("排班结束时间不能早于开始时间");
        }
        shift.setStatus("ACTIVE");
        shift.setCreatedAt(LocalDateTime.now());
        shift.setUpdatedAt(LocalDateTime.now());
        staffShiftMapper.insert(shift);
    }

    public List<StaffShift> getStaffShifts(Long staffId, LocalDate startDate, LocalDate endDate) {
        LambdaQueryWrapper<StaffShift> wrapper = new LambdaQueryWrapper<StaffShift>()
                .eq(StaffShift::getStaffId, staffId)
                .eq(StaffShift::getStatus, "ACTIVE");
        if (startDate != null) {
            wrapper.ge(StaffShift::getShiftDate, startDate);
        }
        if (endDate != null) {
            wrapper.le(StaffShift::getShiftDate, endDate);
        }
        wrapper.orderByAsc(StaffShift::getShiftDate).orderByAsc(StaffShift::getStartTime);
        return staffShiftMapper.selectList(wrapper);
    }

    private StaffDetailVO assembleStaffDetail(StaffProfile profile) {
        StaffDetailVO vo = new StaffDetailVO();
        vo.setProfile(profile);
        vo.setUser(sysUserMapper.selectById(profile.getUserId()));
        vo.setSkills(staffSkillMapper.selectList(new LambdaQueryWrapper<StaffSkill>()
                .eq(StaffSkill::getStaffId, profile.getId())));
        vo.setShifts(staffShiftMapper.selectList(new LambdaQueryWrapper<StaffShift>()
                .eq(StaffShift::getStaffId, profile.getId())
                .ge(StaffShift::getShiftDate, LocalDate.now())
                .orderByAsc(StaffShift::getShiftDate)));
        return vo;
    }
}
