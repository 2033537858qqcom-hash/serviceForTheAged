package com.agedcare.modules.elder.service;

import com.agedcare.common.enums.FamilyBindingStatus;
import com.agedcare.common.enums.UserRole;
import com.agedcare.common.exception.BusinessException;
import com.agedcare.common.security.LoginUser;
import com.agedcare.common.security.UserContext;
import com.agedcare.modules.elder.entity.ElderProfile;
import com.agedcare.modules.elder.mapper.ElderProfileMapper;
import com.agedcare.modules.family.entity.FamilyBinding;
import com.agedcare.modules.family.mapper.FamilyBindingMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ElderProfileService {

    private final ElderProfileMapper elderProfileMapper;
    private final FamilyBindingMapper familyBindingMapper;

    public Page<ElderProfile> pageElders(int pageNum, int pageSize, String name, String community) {
        Page<ElderProfile> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ElderProfile> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(name)) {
            wrapper.like(ElderProfile::getName, name);
        }
        if (StringUtils.hasText(community)) {
            wrapper.eq(ElderProfile::getCommunity, community);
        }
        wrapper.orderByDesc(ElderProfile::getCreatedAt);
        return elderProfileMapper.selectPage(page, wrapper);
    }

    public List<ElderProfile> getAccessibleElders() {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException("请先登录");
        }

        if (UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())) {
            return elderProfileMapper.selectList(new LambdaQueryWrapper<ElderProfile>()
                    .eq(ElderProfile::getStatus, 1)
                    .orderByDesc(ElderProfile::getCreatedAt));
        }

        // 1. 本人作为老人的档案
        List<ElderProfile> selfProfiles = elderProfileMapper.selectList(new LambdaQueryWrapper<ElderProfile>()
                .eq(ElderProfile::getUserId, currentUser.getId())
                .eq(ElderProfile::getStatus, 1));

        // 2. 作为已审核通过家属绑定的老人档案
        List<FamilyBinding> approvedBindings = familyBindingMapper.selectList(new LambdaQueryWrapper<FamilyBinding>()
                .eq(FamilyBinding::getFamilyUserId, currentUser.getId())
                .eq(FamilyBinding::getStatus, FamilyBindingStatus.APPROVED.getCode()));

        List<Long> elderIds = approvedBindings.stream()
                .map(FamilyBinding::getElderId)
                .collect(Collectors.toList());

        List<ElderProfile> boundProfiles = Collections.emptyList();
        if (!CollectionUtils.isEmpty(elderIds)) {
            boundProfiles = elderProfileMapper.selectBatchIds(elderIds);
        }

        List<ElderProfile> result = new ArrayList<>(selfProfiles);
        for (ElderProfile p : boundProfiles) {
            if (result.stream().noneMatch(existing -> existing.getId().equals(p.getId()))) {
                result.add(p);
            }
        }
        return result;
    }

    public ElderProfile getById(Long id) {
        ElderProfile profile = elderProfileMapper.selectById(id);
        if (profile == null) {
            throw new BusinessException("老人档案不存在");
        }
        checkAccessPermission(profile);
        return profile;
    }

    @Transactional(rollbackFor = Exception.class)
    public ElderProfile saveOrUpdate(ElderProfile profile) {
        if (profile.getId() == null) {
            profile.setStatus(1);
            profile.setCreatedAt(LocalDateTime.now());
            profile.setUpdatedAt(LocalDateTime.now());
            elderProfileMapper.insert(profile);
        } else {
            ElderProfile existing = elderProfileMapper.selectById(profile.getId());
            if (existing == null) {
                throw new BusinessException("老人档案不存在");
            }
            checkAccessPermission(existing);
            profile.setUpdatedAt(LocalDateTime.now());
            elderProfileMapper.updateById(profile);
        }
        return profile;
    }

    public void checkAccessPermission(ElderProfile profile) {
        LoginUser currentUser = UserContext.getUser();
        if (currentUser == null) {
            throw new BusinessException("未登录");
        }
        if (UserRole.ADMIN.getCode().equalsIgnoreCase(currentUser.getRole())
                || UserRole.STAFF.getCode().equalsIgnoreCase(currentUser.getRole())) {
            return;
        }

        if (profile.getUserId() != null && profile.getUserId().equals(currentUser.getId())) {
            return;
        }

        Long count = familyBindingMapper.selectCount(new LambdaQueryWrapper<FamilyBinding>()
                .eq(FamilyBinding::getFamilyUserId, currentUser.getId())
                .eq(FamilyBinding::getElderId, profile.getId())
                .eq(FamilyBinding::getStatus, FamilyBindingStatus.APPROVED.getCode()));

        if (count == 0) {
            throw new BusinessException(403, "您未获得该老人的委托授权或授权已被撤销");
        }
    }
}
