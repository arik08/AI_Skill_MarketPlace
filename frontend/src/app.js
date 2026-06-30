const MOCK_SKILLS = window.MOCK_SKILLS || [];
const MOCK_FILE_CONTENTS = window.MOCK_FILE_CONTENTS || {};
const CURRENT_ACCOUNT = {
    id: 'oh-myeongcheol',
    name: '오명철 과장',
    team: '경영기획DX추진TF팀'
};
const ADMIN_ACCESS_PASSWORD = '1';
const ADMIN_MODE_STORAGE_KEY = 'skill-marketplace:admin-mode';
const MARKDOWN_VIEW_MODE_STORAGE_KEY = 'skill-marketplace:markdown-view-mode';

// Global States
        let currentSkills = [];
        let installedSkillIds = new Set();
        let isAdminMode = sessionStorage.getItem(ADMIN_MODE_STORAGE_KEY) === 'true';
        const defaultFilters = {
            category: '전체',
            type: '전체',
            status: '전체',
            visibility: '전체',
            tag: '',
            searchQuery: '',
            myInstalled: false,
            myDrafts: false
        };
        let activeFilters = { ...defaultFilters };
        let currentSort = 'recommended';
        let catalogViewMode = 'detail';
        let activeSkillId = null; // Default selected after the catalog loads.
        let currentRegStep = 1;
        let currentFilePath = '';
        let currentFileContent = '';
        let markdownViewMode = readMarkdownViewMode();
        let isEditingFile = false;
        let isSavingFile = false;
        let isEditingSkillMeta = false;
        let isSavingSkillMeta = false;
        const personalFilterPalettes = {
            installed: {
                base: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3', badgeText: '#3730a3', shadow: '0 4px 12px rgba(79, 70, 229, 0.12)' },
                hover: { bg: '#4f46e5', border: '#4f46e5', text: '#ffffff', badgeText: '#3730a3', shadow: '0 8px 18px rgba(79, 70, 229, 0.2)' },
                active: { bg: '#4f46e5', border: '#4f46e5', text: '#ffffff', badgeText: '#4338ca', shadow: '0 8px 18px rgba(79, 70, 229, 0.18)' },
                activeHover: { bg: '#4338ca', border: '#4338ca', text: '#ffffff', badgeText: '#4338ca', shadow: '0 8px 18px rgba(67, 56, 202, 0.2)' }
            },
            drafts: {
                base: { bg: '#d1fae5', border: '#34d399', text: '#065f46', badgeText: '#065f46', shadow: '0 4px 12px rgba(5, 150, 105, 0.12)' },
                hover: { bg: '#059669', border: '#059669', text: '#ffffff', badgeText: '#065f46', shadow: '0 8px 18px rgba(5, 150, 105, 0.2)' },
                active: { bg: '#059669', border: '#059669', text: '#ffffff', badgeText: '#047857', shadow: '0 8px 18px rgba(5, 150, 105, 0.18)' },
                activeHover: { bg: '#047857', border: '#047857', text: '#ffffff', badgeText: '#047857', shadow: '0 8px 18px rgba(4, 120, 87, 0.2)' }
            }
        };

        // On Page Load
        window.addEventListener('DOMContentLoaded', async () => {
            // Initialize Lucide Icons
            lucide.createIcons();

            currentSkills = await loadSkillCatalog();
            installedSkillIds = await loadInstalledSkillIds();
            hydrateCatalogStateFromUrl();
            
            // Build filter panels
            buildFilterUI();
            syncCatalogControls();
            updateAdminModeControls();
            
            // Initial Render of cards
            applyFilterAndSort();
            history.replaceState(createCatalogHistoryState(), '', createCatalogUrl());

            // Setup Details for the first real skill on startup.
            activeSkillId = currentSkills[0]?.id || null;
            if (activeSkillId) {
                loadSkillDetail(activeSkillId);
            }
        });

        window.addEventListener('popstate', handleCatalogHistoryNavigation);

        function readMarkdownViewMode() {
            const savedMode = sessionStorage.getItem(MARKDOWN_VIEW_MODE_STORAGE_KEY);
            return ['rendered', 'source'].includes(savedMode) ? savedMode : 'rendered';
        }

        async function loadSkillCatalog() {
            try {
                const response = await fetch('/api/skills');
                if (!response.ok) {
                    throw new Error(`Skill API returned ${response.status}`);
                }
                const skills = await response.json();
                if (!Array.isArray(skills) || skills.length === 0) {
                    throw new Error('Skill API returned an empty catalog');
                }
                return skills;
            } catch (error) {
                console.warn('Falling back to local skill catalog.', error);
                return [...MOCK_SKILLS];
            }
        }

        function getLocalInstallStorageKey() {
            return `skill-marketplace:installations:${CURRENT_ACCOUNT.id}`;
        }

        function readLocalInstalledSkillIds() {
            try {
                const parsed = JSON.parse(localStorage.getItem(getLocalInstallStorageKey()) || '[]');
                return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } catch (error) {
                return [];
            }
        }

        function writeLocalInstalledSkillIds(skillIds) {
            localStorage.setItem(getLocalInstallStorageKey(), JSON.stringify([...skillIds]));
        }

        async function loadInstalledSkillIds() {
            try {
                const response = await fetch(`/api/installations?accountId=${encodeURIComponent(CURRENT_ACCOUNT.id)}`);
                if (!response.ok) {
                    throw new Error(`Installations API returned ${response.status}`);
                }
                const payload = await response.json();
                return new Set(Array.isArray(payload.skillIds) ? payload.skillIds : []);
            } catch (error) {
                console.warn('Falling back to local installation state.', error);
                return new Set(readLocalInstalledSkillIds());
            }
        }

        // Keep old inline handlers stable while suppressing toast banners.
        function showToast(message, type = 'success') {
            return { message, type, suppressed: true };
        }

        // View Switching Mechanism
        function switchView(viewName) {
            const marketplaceSection = document.getElementById('view-marketplace');
            const detailSection = document.getElementById('view-detail');
            const navMarket = document.getElementById('nav-marketplace');

            if (viewName === 'marketplace') {
                marketplaceSection.classList.remove('hidden');
                detailSection.classList.add('hidden');
                navMarket.classList.add('bg-slate-100', 'text-slate-800', 'shadow-inner');
                navMarket.classList.remove('text-slate-500');
            } else if (viewName === 'detail') {
                marketplaceSection.classList.add('hidden');
                detailSection.classList.remove('hidden');
                navMarket.classList.remove('bg-slate-100', 'text-slate-800', 'shadow-inner');
                navMarket.classList.add('text-slate-500');
                
                // Refresh Lucide in Details Mode
                lucide.createIcons();
            }
        }

        function openAdminMode() {
            if (isAdminMode) {
                isAdminMode = false;
                sessionStorage.removeItem(ADMIN_MODE_STORAGE_KEY);
                updateAdminModeControls();
                updateEditorControls();
                showToast('Admin 모드를 종료했습니다.', 'info');
                return;
            }

            const modal = document.getElementById('admin-modal');
            const input = document.getElementById('admin-password-input');
            const error = document.getElementById('admin-password-error');

            if (!modal || !input || !error) return;

            input.value = '';
            error.classList.add('hidden');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            input.focus();
            lucide.createIcons({ scope: modal });
        }

        function closeAdminModal() {
            const modal = document.getElementById('admin-modal');
            if (!modal) return;

            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function submitAdminMode(event) {
            event.preventDefault();

            const input = document.getElementById('admin-password-input');
            const error = document.getElementById('admin-password-error');

            if (!input || !error) return;

            if (input.value !== ADMIN_ACCESS_PASSWORD) {
                error.classList.remove('hidden');
                input.select();
                return;
            }

            isAdminMode = true;
            sessionStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'true');
            closeAdminModal();
            updateAdminModeControls();
            updateEditorControls();
            showToast('Admin 모드가 활성화되었습니다.', 'success');
        }

        function updateAdminModeControls() {
            const button = document.getElementById('nav-admin-mode');
            if (!button) return;

            button.classList.toggle('bg-slate-100', isAdminMode);
            button.classList.toggle('text-amber-600', isAdminMode);
            button.classList.toggle('shadow-inner', isAdminMode);
            button.classList.toggle('text-slate-500', !isAdminMode);
            button.setAttribute('aria-pressed', String(isAdminMode));
            button.setAttribute('title', isAdminMode ? '관리자 모드 켜짐' : '관리자 모드');
            button.setAttribute('aria-label', isAdminMode ? '관리자 모드 켜짐' : '관리자 모드');
            button.innerHTML = `
                <i data-lucide="${isAdminMode ? 'shield-check' : 'key-round'}" class="w-4 h-4"></i>
            `;
            lucide.createIcons({ scope: button });
        }

        // Render dynamic Filters Panel
        function buildFilterUI() {
            // Setup Categories
            const categories = ['전체', '공통', '투자관리', '사업관리', '경영기획', '재무', '구매', '설비', '법무', 'HR'];
            const catContainer = document.getElementById('filter-category');
            catContainer.innerHTML = categories.map(cat => `
                <button onclick="setFilter('category', '${cat}')" class="filter-btn min-w-0 text-left text-xs px-2.5 py-2 rounded-lg transition-all keep-korean ${activeFilters.category === cat ? 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                    ${cat}
                </button>
            `).join('');

            // Setup Types
            const types = ['전체', '프롬프트형', '문서분석형', '데이터분석형', '보고서생성형', 'API연계형', 'MCP Tool형'];
            const typeContainer = document.getElementById('filter-type');
            typeContainer.innerHTML = types.map(t => `
                <button onclick="setFilter('type', '${t}')" class="filter-btn min-w-0 text-left text-xs px-2.5 py-2 rounded-lg transition-all keep-korean ${activeFilters.type === t ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                    ${t}
                </button>
            `).join('');

            // Setup Statuses
            const statuses = ['전체', 'Official', 'Verified', 'Beta', 'Draft'];
            const statusContainer = document.getElementById('filter-status');
            statusContainer.innerHTML = statuses.map(st => {
                return `
                    <button onclick="setFilter('status', '${st}')" class="filter-btn min-w-0 text-left text-xs px-2.5 py-2 rounded-lg transition-all keep-korean ${activeFilters.status === st ? 'bg-slate-200 text-slate-800 font-semibold border border-slate-300' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                        ${st === '전체' ? '전체' : `• ${st}`}
                    </button>
                `;
            }).join('');

            // Setup Visibility
            const visibilities = ['전체', '전사 공개', '부서 공개'];
            const visContainer = document.getElementById('filter-visibility');
            visContainer.innerHTML = visibilities.map(v => `
                <button onclick="setFilter('visibility', '${v}')" class="filter-btn min-w-0 text-left text-xs px-2.5 py-2 rounded-lg transition-all keep-korean ${activeFilters.visibility === v ? 'bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                    ${v}
                </button>
            `).join('');
        }

        // Apply filters dynamically and display
        function setFilter(key, value) {
            activeFilters[key] = value;
            refreshCatalogResults();
            pushCatalogHistory();
        }

        function setTagFilter(tag) {
            activeFilters.tag = tag;
            refreshCatalogResults();
            pushCatalogHistory();
            showToast(`#${tag} 태그 스킬만 표시합니다.`, 'info');
        }

        function resetFilters() {
            activeFilters = { ...defaultFilters };
            refreshCatalogResults();
            pushCatalogHistory();
            showToast('필터가 모두 초기화되었습니다.', 'info');
        }

        function showMyInstalledSkills() {
            const willEnable = !activeFilters.myInstalled;
            activeFilters.myInstalled = willEnable;
            activeFilters.myDrafts = false;
            refreshCatalogResults();
            pushCatalogHistory();
            showToast(
                willEnable
                    ? `${CURRENT_ACCOUNT.name} 계정으로 설치한 스킬만 표시합니다.`
                    : '내 설치 스킬 필터를 해제했습니다.',
                'info'
            );
        }

        function showMyDraftSkills() {
            const willEnable = !activeFilters.myDrafts;
            activeFilters.myInstalled = false;
            activeFilters.myDrafts = willEnable;
            refreshCatalogResults();
            pushCatalogHistory();
            showToast(
                willEnable
                    ? `${CURRENT_ACCOUNT.name} 계정의 Draft/Fork 스킬만 표시합니다.`
                    : '내 Draft/Fork 필터를 해제했습니다.',
                'info'
            );
        }

        function isCurrentAccountDraftSkill(skill) {
            if (!skill) return false;

            const isDraft = skill.status === 'Draft';
            const forkedByAccount = skill.forked_by_account_id === CURRENT_ACCOUNT.id;
            const ownDraft = typeof skill.source_path === 'string'
                && skill.source_path.startsWith('drafts/')
                && skill.owner === CURRENT_ACCOUNT.name;

            return isDraft && (forkedByAccount || ownDraft);
        }

        function canCurrentAccountDeleteDraftSkill(skill) {
            return isCurrentAccountDraftSkill(skill);
        }

        function handleSearch() {
            const inputVal = document.getElementById('main-search-input').value.trim();
            activeFilters.searchQuery = inputVal;
            refreshCatalogResults();
            pushCatalogHistory();
            if (inputVal) {
                showToast(`"${inputVal}" 검색 결과를 반영했습니다.`, 'info');
            }
        }

        // Search processing trigger on hitting Enter
        document.getElementById('main-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

        // Main algorithm to filter and order mock data
        function applyFilterAndSort() {
            let filtered = [...currentSkills];

            // 1. Text Search (Matches Title, description, tags, team, owner)
            if (activeFilters.searchQuery) {
                const q = activeFilters.searchQuery.toLowerCase();
                
                // Natural language match expansions
                let expandedTags = [];
                if (q.includes("투자보고서") || q.includes("투자 보고서") || q.includes("자동으로") || q.includes("투자")) {
                    expandedTags.push("투자관리", "보고서생성");
                }

                filtered = filtered.filter(item => {
                    const matchesText = item.name.toLowerCase().includes(q) ||
                                       item.short_description.toLowerCase().includes(q) ||
                                       item.owner.toLowerCase().includes(q) ||
                                       item.team.toLowerCase().includes(q) ||
                                       item.tags.some(t => t.toLowerCase().includes(q));
                    
                    const matchesExpanded = expandedTags.length > 0 && item.tags.some(t => expandedTags.includes(t));
                    return matchesText || matchesExpanded;
                });
            }

            // 2. Current account installation filter
            if (activeFilters.myInstalled) {
                filtered = filtered.filter(item => installedSkillIds.has(item.id));
            }

            // 3. Current account draft/fork filter
            if (activeFilters.myDrafts) {
                filtered = filtered.filter(isCurrentAccountDraftSkill);
            }

            // 4. Category Filter
            if (activeFilters.category !== '전체') {
                filtered = filtered.filter(item => item.category === activeFilters.category);
            }

            // 5. Type Filter
            if (activeFilters.type !== '전체') {
                filtered = filtered.filter(item => item.type === activeFilters.type);
            }

            // 6. Status Filter
            if (activeFilters.status !== '전체') {
                filtered = filtered.filter(item => item.status === activeFilters.status);
            }

            // 7. Visibility Filter
            if (activeFilters.visibility !== '전체') {
                filtered = filtered.filter(item => item.visibility === activeFilters.visibility);
            }

            // 8. Exact Tag Filter
            if (activeFilters.tag) {
                filtered = filtered.filter(item => item.tags.includes(activeFilters.tag));
            }

            // Apply Sorting
            if (currentSort === 'recommended') {
                filtered.sort((a, b) => b.quality_score - a.quality_score);
            } else if (currentSort === 'download') {
                filtered.sort((a, b) => b.downloads - a.downloads);
            } else if (currentSort === 'run') {
                filtered.sort((a, b) => b.runs - a.runs);
            } else if (currentSort === 'like') {
                filtered.sort((a, b) => b.likes - a.likes);
            } else if (currentSort === 'quality') {
                filtered.sort((a, b) => b.quality_score - a.quality_score);
            } else if (currentSort === 'recent') {
                filtered.sort((a, b) => new Date(b.updated_at.replace(/\./g, '-')) - new Date(a.updated_at.replace(/\./g, '-')));
            }

            renderActiveBadges();
            renderSkillCards(filtered);
        }

        // Render Active Filter Pills
        function renderActiveBadges() {
            const container = document.getElementById('active-filter-badges');
            let badgesHTML = '';

            for (const [key, value] of Object.entries(activeFilters)) {
                if (value && value !== '전체') {
                    const labelMapping = {
                        category: '영역',
                        type: '유형',
                        status: '상태',
                        visibility: '공개',
                        tag: '태그',
                        searchQuery: '검색어',
                        myInstalled: '설치',
                        myDrafts: '소유'
                    };
                    const displayValue = key === 'myInstalled'
                        ? '내 설치 스킬'
                        : key === 'myDrafts' ? '내 Draft/Fork' : value;
                    badgesHTML += `
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-slate-600 rounded-full text-xs border border-slate-200 shadow-sm">
                            <span class="text-slate-400 text-[10px] uppercase font-bold">${labelMapping[key]}:</span>
                            <strong>${key === 'tag' ? `#${value}` : displayValue}</strong>
                            <button onclick="clearSpecificFilter('${key}')" class="text-slate-400 hover:text-slate-800 transition-colors">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </span>
                    `;
                }
            }

            container.innerHTML = badgesHTML;
            container.classList.toggle('hidden', badgesHTML.trim() === '');
            container.classList.toggle('flex', badgesHTML.trim() !== '');
            lucide.createIcons();
        }

        function clearSpecificFilter(key) {
            activeFilters[key] = defaultFilters[key];
            refreshCatalogResults();
            pushCatalogHistory();
        }

        function handleSort() {
            currentSort = document.getElementById('sort-select').value;
            applyFilterAndSort();
            pushCatalogHistory();
        }

        function setCatalogViewMode(mode) {
            if (!['detail', 'summary'].includes(mode)) return;

            catalogViewMode = mode;
            syncCatalogControls();
            applyFilterAndSort();
            pushCatalogHistory();
        }

        function refreshCatalogResults() {
            buildFilterUI();
            syncCatalogControls();
            applyFilterAndSort();
        }

        function applyPersonalFilterButtonStyle(button, colors) {
            button.style.backgroundColor = colors.bg;
            button.style.borderColor = colors.border;
            button.style.color = colors.text;
            button.style.boxShadow = colors.shadow;

            const countBadge = button.querySelector('.personal-filter-count');
            if (countBadge) {
                countBadge.style.backgroundColor = '#ffffff';
                countBadge.style.borderColor = 'rgba(255, 255, 255, 0.72)';
                countBadge.style.color = colors.badgeText;
            }
        }

        function syncPersonalFilterButton(button, isActive, palette) {
            if (!button) return;

            button.classList.toggle('is-active', isActive);
            applyPersonalFilterButtonStyle(button, isActive ? palette.active : palette.base);
            button.onmouseenter = () => applyPersonalFilterButtonStyle(button, isActive ? palette.activeHover : palette.hover);
            button.onmouseleave = () => applyPersonalFilterButtonStyle(button, isActive ? palette.active : palette.base);
        }

        function syncCatalogControls() {
            const searchInput = document.getElementById('main-search-input');
            if (searchInput) searchInput.value = activeFilters.searchQuery;

            const sortSelect = document.getElementById('sort-select');
            if (sortSelect) sortSelect.value = currentSort;

            const detailModeButton = document.getElementById('view-mode-detail');
            const summaryModeButton = document.getElementById('view-mode-summary');
            for (const [button, mode] of [[detailModeButton, 'detail'], [summaryModeButton, 'summary']]) {
                if (!button) continue;

                const isActive = catalogViewMode === mode;
                button.classList.toggle('bg-white', isActive);
                button.classList.toggle('text-slate-900', isActive);
                button.classList.toggle('shadow-sm', isActive);
                button.classList.toggle('text-slate-500', !isActive);
                button.classList.toggle('hover:text-slate-900', !isActive);
                button.classList.toggle('hover:bg-white/70', !isActive);
            }

            const myInstalledButton = document.getElementById('my-installed-filter-button');
            if (myInstalledButton) {
                myInstalledButton.classList.toggle('bg-indigo-600', activeFilters.myInstalled);
                myInstalledButton.classList.toggle('text-white', activeFilters.myInstalled);
                myInstalledButton.classList.toggle('border-indigo-600', activeFilters.myInstalled);
                myInstalledButton.classList.toggle('hover:bg-indigo-700', activeFilters.myInstalled);
                myInstalledButton.classList.toggle('hover:border-indigo-700', activeFilters.myInstalled);
                myInstalledButton.classList.toggle('bg-indigo-50', !activeFilters.myInstalled);
                myInstalledButton.classList.toggle('text-indigo-700', !activeFilters.myInstalled);
                myInstalledButton.classList.toggle('border-indigo-100', !activeFilters.myInstalled);
                myInstalledButton.classList.toggle('hover:bg-indigo-600', !activeFilters.myInstalled);
                myInstalledButton.classList.toggle('hover:border-indigo-600', !activeFilters.myInstalled);
                syncPersonalFilterButton(myInstalledButton, activeFilters.myInstalled, personalFilterPalettes.installed);
            }

            const myInstalledCount = document.getElementById('my-installed-count');
            if (myInstalledCount) myInstalledCount.textContent = installedSkillIds.size;

            const myDraftsButton = document.getElementById('my-drafts-filter-button');
            if (myDraftsButton) {
                myDraftsButton.classList.toggle('bg-emerald-600', activeFilters.myDrafts);
                myDraftsButton.classList.toggle('text-white', activeFilters.myDrafts);
                myDraftsButton.classList.toggle('border-emerald-600', activeFilters.myDrafts);
                myDraftsButton.classList.toggle('hover:bg-emerald-700', activeFilters.myDrafts);
                myDraftsButton.classList.toggle('hover:border-emerald-700', activeFilters.myDrafts);
                myDraftsButton.classList.toggle('bg-emerald-50', !activeFilters.myDrafts);
                myDraftsButton.classList.toggle('text-emerald-700', !activeFilters.myDrafts);
                myDraftsButton.classList.toggle('border-emerald-200', !activeFilters.myDrafts);
                myDraftsButton.classList.toggle('hover:bg-emerald-600', !activeFilters.myDrafts);
                myDraftsButton.classList.toggle('hover:border-emerald-600', !activeFilters.myDrafts);
                syncPersonalFilterButton(myDraftsButton, activeFilters.myDrafts, personalFilterPalettes.drafts);
            }

            const myDraftsCount = document.getElementById('my-drafts-count');
            if (myDraftsCount) myDraftsCount.textContent = currentSkills.filter(isCurrentAccountDraftSkill).length;
        }

        function hydrateCatalogStateFromUrl() {
            const params = new URLSearchParams(window.location.search);
            activeFilters = { ...defaultFilters };

            const queryMap = {
                category: 'category',
                type: 'type',
                status: 'status',
                visibility: 'visibility',
                tag: 'tag',
                searchQuery: 'q',
                myInstalled: 'installed',
                myDrafts: 'drafts'
            };

            for (const [filterKey, queryKey] of Object.entries(queryMap)) {
                if (params.has(queryKey)) {
                    activeFilters[filterKey] = filterKey === 'myInstalled'
                        ? params.get(queryKey) === 'mine'
                        : filterKey === 'myDrafts' ? params.get(queryKey) === 'mine'
                        : params.get(queryKey) || defaultFilters[filterKey];
                }
            }

            currentSort = params.get('sort') || 'recommended';
            catalogViewMode = params.get('view') === 'summary' ? 'summary' : 'detail';
            normalizePersonalFilterMode();
        }

        function handleCatalogHistoryNavigation(event) {
            const catalogState = event.state?.catalog;
            const detailState = event.state?.detail;

            if (catalogState) {
                activeFilters = { ...defaultFilters, ...catalogState.filters };
                currentSort = catalogState.sort || 'recommended';
                catalogViewMode = catalogState.viewMode || 'detail';
                normalizePersonalFilterMode();
            } else {
                hydrateCatalogStateFromUrl();
            }

            refreshCatalogResults();

            if (detailState?.skillId) {
                activeSkillId = detailState.skillId;
                loadSkillDetail(detailState.skillId);
                switchView('detail');
                return;
            }

            switchView('marketplace');
        }

        function normalizePersonalFilterMode() {
            if (activeFilters.myInstalled && activeFilters.myDrafts) {
                activeFilters.myInstalled = false;
            }
        }

        function createCatalogHistoryState() {
            return {
                catalog: {
                    filters: { ...activeFilters },
                    sort: currentSort,
                    viewMode: catalogViewMode
                }
            };
        }

        function createDetailHistoryState(skillId) {
            return {
                ...createCatalogHistoryState(),
                detail: { skillId }
            };
        }

        function createCatalogUrl() {
            const params = new URLSearchParams();
            const queryMap = {
                category: 'category',
                type: 'type',
                status: 'status',
                visibility: 'visibility',
                tag: 'tag',
                searchQuery: 'q',
                myInstalled: 'installed',
                myDrafts: 'drafts'
            };

            for (const [filterKey, queryKey] of Object.entries(queryMap)) {
                const value = activeFilters[filterKey];
                if (value && value !== defaultFilters[filterKey]) {
                    params.set(queryKey, filterKey === 'myInstalled' || filterKey === 'myDrafts' ? 'mine' : value);
                }
            }

            if (currentSort !== 'recommended') {
                params.set('sort', currentSort);
            }

            if (catalogViewMode !== 'detail') {
                params.set('view', catalogViewMode);
            }

            const query = params.toString();
            return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
        }

        function pushCatalogHistory() {
            const nextUrl = createCatalogUrl();
            const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

            if (nextUrl === currentUrl) {
                history.replaceState(createCatalogHistoryState(), '', createCatalogUrl());
                return;
            }

            history.pushState(createCatalogHistoryState(), '', createCatalogUrl());
        }

        function pushDetailHistory(skillId) {
            history.pushState(createDetailHistoryState(skillId), '', createCatalogUrl());
        }

        function navigateBackToCatalog() {
            if (history.state?.detail) {
                history.back();
                return;
            }

            switchView('marketplace');
            history.replaceState(createCatalogHistoryState(), '', createCatalogUrl());
        }

        function returnToMarketplaceHome() {
            resetFilters();
            switchView('marketplace');
            history.replaceState(createCatalogHistoryState(), '', createCatalogUrl());
        }

        // Render Skill Cards to GRID
        function renderSkillCards(skills) {
            const grid = document.getElementById('skills-grid');
            const countLabel = document.getElementById('skills-count');
            countLabel.textContent = skills.length;

            if (skills.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
                        <i data-lucide="folder-search" class="w-12 h-12 mx-auto text-slate-300 mb-3"></i>
                        <h4 class="font-bold text-slate-700 mb-1">검색 결과가 없습니다</h4>
                        <p class="text-xs max-w-sm mx-auto">상세 필터 또는 검색 조건을 변경하여 다시 확인해보세요.</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }

            if (catalogViewMode === 'summary') {
                renderSummarySkillCards(grid, skills);
                return;
            }

            grid.innerHTML = skills.map(skill => {
                // Status Badge styling for light theme
                let badgeClass = 'bg-slate-100 text-slate-600 border-slate-250';
                if (skill.status === 'Official') badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (skill.status === 'Verified') badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                if (skill.status === 'Beta') badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                if (skill.status === 'Draft') badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
                const isInstalled = installedSkillIds.has(skill.id);

                return `
                    <div data-skill-id="${skill.id}" class="bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-2xl p-5 transition-all flex flex-col justify-between group relative overflow-hidden shadow-sm hover:shadow-md">
                        
                        <!-- Header Line with Status Badge -->
                        <div>
                            <div class="flex items-start justify-between gap-2 mb-3">
                                <div class="min-w-0">
                                    <span class="inline-block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">${skill.type}</span>
                                    <h3 class="font-bold text-slate-800 transition-colors text-sm sm:text-base flex items-center gap-1.5 keep-korean">
                                        ${skill.name}
                                    </h3>
                                </div>
                                <span class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}">
                                    ${skill.status}
                                </span>
                            </div>

                            <!-- Description -->
                            <p class="skill-card-description text-xs text-slate-500 leading-relaxed mb-4">
                                ${skill.short_description}
                            </p>

                            <!-- Tag pills -->
                            <div class="flex flex-wrap gap-1 mb-4">
                                ${skill.tags.slice(0, 4).map(tag => `
                                    <button type="button" onclick="setTagFilter('${escapeJsString(tag)}')" class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer">#${escapeHTML(tag)}</button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Footer Information -->
                        <div class="border-t border-slate-100 pt-4 mt-auto space-y-3">
                            <!-- Owner Meta -->
                            <div class="flex items-center justify-between text-xs text-slate-500">
                                <span>등록자: <strong class="text-slate-700 font-semibold">${skill.owner}</strong> / <span class="text-slate-400">${skill.team}</span></span>
                                <span class="text-[11px] font-bold text-emerald-600" title="종합 품질 점수">QA ${skill.quality_score}점</span>
                            </div>

                            <!-- Counter Statistics -->
                            <div class="flex items-center justify-between gap-1 text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                <span class="flex items-center gap-0.5" title="다운로드수"><i data-lucide="download" class="w-3 h-3 text-slate-400"></i> ${skill.downloads.toLocaleString()}</span>
                                <span class="flex items-center gap-0.5" title="총 실행수"><i data-lucide="play" class="w-3 h-3 text-slate-400"></i> ${skill.runs.toLocaleString()}</span>
                                <span class="flex items-center gap-0.5" title="좋아요수"><i data-lucide="thumbs-up" class="w-3 h-3 text-pink-500"></i> ${skill.likes}</span>
                                <span class="flex items-center gap-0.5 text-emerald-600 font-semibold" title="실행성공률"><i data-lucide="shield-check" class="w-3 h-3 text-emerald-500"></i> ${skill.success_rate}%</span>
                            </div>

                            <!-- Interactive Buttons inside Card -->
                            <div class="grid grid-cols-2 gap-2 pt-1">
                                ${renderCatalogPrimaryActionButton(skill)}
                                <button onclick="viewSkillDetails('${skill.id}')" class="w-full py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-semibold text-xs rounded-lg transition-all active:scale-95 border border-blue-200/50 hover:border-transparent flex items-center justify-center gap-1">
                                    상세보기 <i data-lucide="chevron-right" class="w-3 h-3"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Setup icons after draw
            lucide.createIcons();
        }

        function getStatusBadgeClass(status) {
            if (status === 'Official') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            if (status === 'Verified') return 'bg-blue-50 text-blue-700 border-blue-200';
            if (status === 'Beta') return 'bg-amber-50 text-amber-700 border-amber-200';
            if (status === 'Draft') return 'bg-slate-100 text-slate-500 border-slate-200';
            return 'bg-slate-100 text-slate-600 border-slate-200';
        }

        function renderCatalogPrimaryActionButton(skill, options = {}) {
            if (canCurrentAccountDeleteDraftSkill(skill)) {
                return renderDeleteDraftActionButton(skill, options);
            }

            return renderInstallActionButton(skill, options);
        }

        function renderDeleteDraftActionButton(skill, options = {}) {
            const showIcon = options.showIcon !== false;
            const iconMarkup = showIcon ? '<i data-lucide="trash-2" class="w-3 h-3"></i>' : '';

            return `
                <button onclick="quickAction('${skill.id}', 'delete-draft')" class="draft-delete-action-button w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300 font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1 border">
                    ${iconMarkup}
                    <span>삭제</span>
                </button>
            `;
        }

        function renderInstallActionButton(skill, options = {}) {
            const isInstalled = installedSkillIds.has(skill.id);
            const showIcon = options.showIcon !== false;
            const iconMarkup = showIcon
                ? `<i data-lucide="download" class="install-default-icon w-3 h-3"></i><i data-lucide="trash-2" class="install-hover-icon w-3 h-3"></i>`
                : '';

            return `
                <button onclick="quickAction('${skill.id}', '${isInstalled ? 'uninstall' : 'install'}')" class="install-action-button ${isInstalled ? 'is-installed bg-indigo-50 text-indigo-700 border-indigo-100' : 'is-uninstalled bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 border-slate-200/50'} w-full py-1.5 font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1 border">
                    ${iconMarkup}
                    <span class="install-default-label">${isInstalled ? '설치됨' : '설치'}</span>
                    ${isInstalled ? '<span class="install-hover-label">삭제</span>' : ''}
                </button>
            `;
        }

        function renderSummarySkillCards(grid, skills) {
            grid.innerHTML = skills.map(skill => {
                const isInstalled = installedSkillIds.has(skill.id);
                const badgeClass = getStatusBadgeClass(skill.status);

                return `
                    <div data-skill-id="${skill.id}" class="h-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all shadow-sm hover:shadow-md flex flex-col">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <span class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">${skill.type}</span>
                                <h3 class="font-bold text-slate-800 text-sm leading-snug flex flex-wrap items-center gap-1.5 keep-korean">
                                    ${skill.name}
                                </h3>
                                <p class="summary-skill-description keep-korean mt-1.5 text-xs leading-relaxed text-slate-500">
                                    ${skill.short_description}
                                </p>
                            </div>
                            <span class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}">
                                ${skill.status}
                            </span>
                        </div>

                        <div class="grid grid-cols-2 gap-2 mt-auto pt-4">
                            ${renderCatalogPrimaryActionButton(skill, { showIcon: false })}
                            <button onclick="viewSkillDetails('${skill.id}')" class="w-full py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-semibold text-xs rounded-lg transition-all active:scale-95 border border-blue-200/50 hover:border-transparent flex items-center justify-center">
                                상세보기
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Quick download simulator from card
        async function quickAction(skillId, type) {
            const skill = currentSkills.find(s => s.id === skillId);
            if (!skill) return;

            if (type === 'install') {
                await installSkillForCurrentAccount(skill);
            } else if (type === 'uninstall') {
                await uninstallSkillForCurrentAccount(skill);
            } else if (type === 'delete-draft') {
                await deleteDraftSkillForCurrentAccount(skill);
            }
        }

        async function installSkillForCurrentAccount(skill) {
            const wasInstalled = installedSkillIds.has(skill.id);

            try {
                const response = await fetch('/api/installations', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        accountId: CURRENT_ACCOUNT.id,
                        skillId: skill.id
                    })
                });

                if (!response.ok) {
                    throw new Error(`Installations API returned ${response.status}`);
                }

                const payload = await response.json();
                installedSkillIds = new Set(Array.isArray(payload.skillIds) ? payload.skillIds : [...installedSkillIds, skill.id]);
            } catch (error) {
                console.warn('Falling back to local installation write.', error);
                installedSkillIds.add(skill.id);
                writeLocalInstalledSkillIds(installedSkillIds);
            }

            if (!wasInstalled) {
                skill.downloads++;
            }

            refreshCatalogResults();
            updateDetailInstallButton();
            showToast(`[${skill.name}] 스킬이 ${CURRENT_ACCOUNT.name} 계정에 설치되었습니다.`, 'success');
        }

        async function uninstallSkillForCurrentAccount(skill) {
            try {
                const response = await fetch('/api/installations', {
                    method: 'DELETE',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        accountId: CURRENT_ACCOUNT.id,
                        skillId: skill.id
                    })
                });

                if (!response.ok) {
                    throw new Error(`Installations API returned ${response.status}`);
                }

                const payload = await response.json();
                installedSkillIds = new Set(Array.isArray(payload.skillIds)
                    ? payload.skillIds
                    : [...installedSkillIds].filter(skillId => skillId !== skill.id));
            } catch (error) {
                console.warn('Falling back to local installation removal.', error);
                installedSkillIds.delete(skill.id);
                writeLocalInstalledSkillIds(installedSkillIds);
            }

            refreshCatalogResults();
            updateDetailInstallButton();
            showToast(`[${skill.name}] 스킬 설치를 삭제했습니다.`, 'info');
        }

        async function deleteDraftSkillForCurrentAccount(skill) {
            if (!canCurrentAccountDeleteDraftSkill(skill)) {
                showToast('내 Draft/Fork 스킬만 삭제할 수 있습니다.', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/skills/${encodeURIComponent(skill.id)}`, {
                    method: 'DELETE',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        accountId: CURRENT_ACCOUNT.id,
                        accountName: CURRENT_ACCOUNT.name
                    })
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload.error || `Skill delete failed with ${response.status}`);
                }

                currentSkills = currentSkills.filter(candidate => candidate.id !== skill.id);
                installedSkillIds.delete(skill.id);
                refreshCatalogResults();

                if (activeSkillId === skill.id) {
                    activeSkillId = null;
                    navigateBackToCatalog();
                }

                showToast(`[${skill.name}] Draft/Fork 스킬을 삭제했습니다.`, 'info');
            } catch (error) {
                console.error(error);
                showToast(error.message || 'Draft/Fork 스킬 삭제에 실패했습니다.', 'error');
            }
        }

        // View Mode 2: Skill Explorer Loading
        function viewSkillDetails(skillId) {
            activeSkillId = skillId;
            loadSkillDetail(skillId);
            pushDetailHistory(skillId);
            switchView('detail');
        }

        // Populate VS Code style layout
        function loadSkillDetail(skillId) {
            const skill = currentSkills.find(s => s.id === skillId);
            if (!skill) return;

            // Header Elements update
            document.getElementById('detail-skill-name').textContent = skill.name;
            document.getElementById('detail-short-desc').textContent = skill.short_description;
            document.getElementById('detail-owner').textContent = `${skill.owner} / ${skill.team}`;
            document.getElementById('detail-version').textContent = skill.version;
            document.getElementById('detail-quality').textContent = `${skill.quality_score}점`;
            
            document.getElementById('detail-down-cnt').textContent = skill.downloads.toLocaleString();
            document.getElementById('detail-run-cnt').textContent = skill.runs.toLocaleString();
            document.getElementById('detail-like-cnt').textContent = skill.likes;
            document.getElementById('detail-success-rate').textContent = `${skill.success_rate}%`;
            updateDetailInstallButton(skill.id);

            // Status Badge (Light theme adjusted)
            const statusBadge = document.getElementById('detail-status-badge');
            statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded border';
            if (skill.status === 'Official') statusBadge.className += ' bg-emerald-50 text-emerald-700 border-emerald-200';
            else if (skill.status === 'Verified') statusBadge.className += ' bg-blue-50 text-blue-700 border-blue-200';
            else statusBadge.className += ' bg-amber-50 text-amber-700 border-amber-200';
            statusBadge.textContent = skill.status;

            // Sidebar Explorer Score Bar Update
            document.getElementById('quality-indicator-score').textContent = `${skill.quality_score}/100`;
            document.getElementById('quality-indicator-bar').style.width = `${skill.quality_score}%`;

            // Render Explorer Tree (VS Code-like file structure)
            renderExplorerTree(skill);
            updateSkillMetaControls();

            // Load initial file (real Codex skill entrypoint)
            loadWorkspaceFileByPath(skill.entrypoint || 'SKILL.md');
        }

        function updateDetailInstallButton(skillId = activeSkillId) {
            const button = document.getElementById('btn-install');
            if (!button || !skillId) return;

            const skill = currentSkills.find(candidate => candidate.id === skillId);
            if (canCurrentAccountDeleteDraftSkill(skill)) {
                button.className = 'detail-action-button draft-delete-action-button bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm';
                button.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i><span>삭제</span>';
                lucide.createIcons({attrs: {"stroke-width": 2}, nameAttr: "data-lucide", scope: button});
                return;
            }

            const isInstalled = installedSkillIds.has(skillId);
            button.className = `detail-action-button install-action-button ${isInstalled ? 'is-installed bg-indigo-50 text-indigo-700 border border-indigo-100' : 'is-uninstalled bg-indigo-600 hover:bg-indigo-500 text-white'} flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm`;
            button.innerHTML = `
                <i data-lucide="download" class="install-default-icon w-3.5 h-3.5"></i>
                <i data-lucide="trash-2" class="install-hover-icon w-3.5 h-3.5"></i>
                <span class="install-default-label">${isInstalled ? '설치됨' : '설치하기'}</span>
                ${isInstalled ? '<span class="install-hover-label">삭제</span>' : ''}
            `;
            lucide.createIcons({attrs: {"stroke-width": 2}, nameAttr: "data-lucide", scope: button});
        }

        // Render Tree folders
        function renderExplorerTree(skill) {
            const container = document.getElementById('explorer-tree');
            const files = Array.isArray(skill.files) && skill.files.length > 0
                ? [...skill.files]
                : ['SKILL.md', 'skill.json'];
            const rootFiles = files.filter(filePath => !filePath.includes('/')).sort(skillFileSort);
            const groupedFiles = files
                .filter(filePath => filePath.includes('/'))
                .sort(skillFileSort)
                .reduce((groups, filePath) => {
                    const [folder] = filePath.split('/');
                    if (!groups.has(folder)) groups.set(folder, []);
                    groups.get(folder).push(filePath);
                    return groups;
                }, new Map());

            const rootHtml = rootFiles.length > 0
                ? renderFileGroup('Skill Root', rootFiles)
                : '';
            const folderHtml = [...groupedFiles.entries()]
                .map(([folder, folderFiles]) => renderFileGroup(folder, folderFiles))
                .join('');

            container.innerHTML = rootHtml + folderHtml;
            lucide.createIcons();
        }

        function renderFileGroup(label, files) {
            return `
                <div class="space-y-0.5 mt-2">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> ${escapeHTML(label)}
                    </div>
                    <div class="pl-2 pr-1">
                        ${files.map(filePath => renderFileNode(filePath)).join('')}
                    </div>
                </div>
            `;
        }

        function renderFileNode(filePath) {
            const filename = filePath.split('/').pop();
            const nodeId = fileNodeId(filePath);
            const iconName = iconForSkillFile(filePath);
            const iconColor = colorForSkillFile(filePath);

            return `
                <button onclick="loadWorkspaceFileByPath('${escapeJsString(filePath)}')" id="${nodeId}" title="${escapeHTML(filePath)}" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                    <i data-lucide="${iconName}" class="w-3.5 h-3.5 ${iconColor}"></i> ${escapeHTML(filename)}
                </button>
            `;
        }

        function skillFileSort(a, b) {
            const preferred = ['SKILL.md', 'skill.json', 'agents/openai.yaml', 'references/input.schema.json', 'examples/sample-input.json'];
            const ai = preferred.indexOf(a);
            const bi = preferred.indexOf(b);

            if (ai !== -1 || bi !== -1) {
                return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
            }

            return a.localeCompare(b);
        }

        function fileNodeId(filePath) {
            return `node-${filePath.replace(/[^a-z0-9_-]/gi, '_')}`;
        }

        function iconForSkillFile(filePath) {
            if (filePath === 'SKILL.md') return 'book-open-check';
            if (filePath.endsWith('.json')) return 'braces';
            if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'file-code';
            if (filePath.endsWith('.md')) return 'file-text';
            return 'file';
        }

        function colorForSkillFile(filePath) {
            if (filePath === 'SKILL.md') return 'text-indigo-600';
            if (filePath.endsWith('.json')) return 'text-teal-600';
            if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'text-amber-600';
            if (filePath.endsWith('.md')) return 'text-blue-600';
            return 'text-slate-500';
        }

        function escapeJsString(value) {
            return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        }

        function replaceSkillInCatalog(updatedSkill) {
            const index = currentSkills.findIndex(skill => skill.id === updatedSkill.id);

            if (index >= 0) {
                currentSkills[index] = updatedSkill;
            } else {
                currentSkills.unshift(updatedSkill);
            }
        }

        function canCurrentAccountEditSkill(skill) {
            if (!skill) return false;
            if (isAdminMode) return true;

            const ownedByName = skill.owner === CURRENT_ACCOUNT.name;
            const forkedByAccount = skill.forked_by_account_id === CURRENT_ACCOUNT.id;
            const ownDraft = typeof skill.source_path === 'string'
                && skill.source_path.startsWith('drafts/')
                && skill.owner === CURRENT_ACCOUNT.name;

            return ownedByName || forkedByAccount || ownDraft;
        }

        function updateSkillMetaControls() {
            const skill = currentSkills.find(s => s.id === activeSkillId);
            const canEdit = canCurrentAccountEditSkill(skill);
            const editButton = document.getElementById('btn-edit-skill-meta');
            const editor = document.getElementById('skill-meta-editor');
            const saveButton = document.getElementById('btn-save-skill-meta');

            if (!editButton || !editor || !saveButton) return;

            editButton.classList.toggle('hidden', !canEdit || isEditingSkillMeta);
            editButton.classList.toggle('inline-flex', canEdit && !isEditingSkillMeta);
            editor.classList.toggle('hidden', !isEditingSkillMeta);
            saveButton.disabled = isSavingSkillMeta;
            saveButton.classList.toggle('opacity-60', isSavingSkillMeta);
            lucide.createIcons({ scope: editButton.parentElement });
            lucide.createIcons({ scope: editor });
        }

        function readEditableSkillManifest(skill) {
            const fallbackManifest = (() => {
                const { file_contents, files, source_path, has_manifest, ...manifest } = skill;
                return manifest;
            })();

            const manifestContent = skill.file_contents?.['skill.json'];
            if (!manifestContent) return fallbackManifest;

            try {
                return JSON.parse(manifestContent);
            } catch (error) {
                return fallbackManifest;
            }
        }

        function openSkillMetaEditor() {
            const skill = currentSkills.find(s => s.id === activeSkillId);

            if (!canCurrentAccountEditSkill(skill)) {
                showToast('본인이 만든 스킬 또는 Fork한 스킬만 수정할 수 있습니다.', 'error');
                return;
            }

            const manifest = readEditableSkillManifest(skill);
            document.getElementById('skill-meta-name').value = manifest.name || skill.name || '';
            document.getElementById('skill-meta-short-description').value = manifest.short_description || skill.short_description || '';
            document.getElementById('skill-meta-status').value = manifest.status || skill.status || 'Draft';

            isEditingSkillMeta = true;
            updateSkillMetaControls();
            document.getElementById('skill-meta-name')?.focus();
        }

        function closeSkillMetaEditor() {
            isEditingSkillMeta = false;
            updateSkillMetaControls();
        }

        async function saveSkillMetaEdit(event) {
            event?.preventDefault();

            const skill = currentSkills.find(s => s.id === activeSkillId);
            if (!skill || isSavingSkillMeta) return;

            const name = document.getElementById('skill-meta-name')?.value.trim();
            const shortDescription = document.getElementById('skill-meta-short-description')?.value.trim();
            const status = document.getElementById('skill-meta-status')?.value || skill.status;

            if (!name || !shortDescription) {
                showToast('스킬명과 한 줄 설명을 입력해주세요.', 'error');
                return;
            }

            const manifest = {
                ...readEditableSkillManifest(skill),
                name,
                short_description: shortDescription,
                status
            };

            isSavingSkillMeta = true;
            updateSkillMetaControls();

            try {
                const selectedFilePath = currentFilePath || skill.entrypoint || 'SKILL.md';
                const response = await fetch(`/api/skills/${encodeURIComponent(activeSkillId)}/files`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountId: CURRENT_ACCOUNT.id,
                        accountName: CURRENT_ACCOUNT.name,
                        adminPassword: isAdminMode ? ADMIN_ACCESS_PASSWORD : undefined,
                        filePath: 'skill.json',
                        content: `${JSON.stringify(manifest, null, 2)}\n`
                    })
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload.error || `Skill metadata save failed with ${response.status}`);
                }

                replaceSkillInCatalog(payload.skill);
                isEditingSkillMeta = false;
                applyFilterAndSort();
                loadSkillDetail(payload.skill.id);
                loadWorkspaceFileByPath(selectedFilePath);
                showToast('스킬 정보를 저장했습니다.', 'success');
            } catch (error) {
                console.error(error);
                showToast(error.message || '스킬 정보 저장에 실패했습니다.', 'error');
            } finally {
                isSavingSkillMeta = false;
                updateSkillMetaControls();
            }
        }

        function updateEditorControls() {
            const skill = currentSkills.find(s => s.id === activeSkillId);
            const canEdit = canCurrentAccountEditSkill(skill);
            const editButton = document.getElementById('btn-edit-file');
            const saveButton = document.getElementById('btn-save-file');
            const cancelButton = document.getElementById('btn-cancel-edit');

            if (!editButton || !saveButton || !cancelButton) return;

            updateSkillMetaControls();
            updateMarkdownViewControls();
            editButton.classList.toggle('hidden', !canEdit || isEditingFile);
            editButton.classList.toggle('flex', canEdit && !isEditingFile);
            saveButton.classList.toggle('hidden', !isEditingFile);
            saveButton.classList.toggle('flex', isEditingFile);
            saveButton.disabled = isSavingFile;
            saveButton.classList.toggle('opacity-60', isSavingFile);
            cancelButton.classList.toggle('hidden', !isEditingFile);
            cancelButton.classList.toggle('flex', isEditingFile);

            lucide.createIcons({ scope: editButton.parentElement });
        }

        function isMarkdownFile(filePath) {
            return filePath.split('/').pop().toLowerCase().endsWith('.md');
        }

        function updateMarkdownViewControls() {
            const toggle = document.getElementById('markdown-view-toggle');
            const renderedButton = document.getElementById('btn-markdown-rendered');
            const sourceButton = document.getElementById('btn-markdown-source');
            const showToggle = isMarkdownFile(currentFilePath) && !isEditingFile;

            if (!toggle || !renderedButton || !sourceButton) return;

            toggle.classList.toggle('hidden', !showToggle);
            toggle.classList.toggle('flex', showToggle);

            for (const [button, mode] of [[renderedButton, 'rendered'], [sourceButton, 'source']]) {
                const isActive = markdownViewMode === mode;
                button.classList.toggle('bg-indigo-600', isActive);
                button.classList.toggle('text-white', isActive);
                button.classList.toggle('shadow-sm', isActive);
                button.classList.toggle('text-slate-500', !isActive);
                button.classList.toggle('hover:text-slate-800', !isActive);
                button.classList.toggle('hover:bg-slate-100', !isActive);
                button.setAttribute('aria-pressed', String(isActive));
            }
        }

        function setMarkdownViewMode(mode) {
            if (!['rendered', 'source'].includes(mode) || !isMarkdownFile(currentFilePath)) return;

            markdownViewMode = mode;
            sessionStorage.setItem(MARKDOWN_VIEW_MODE_STORAGE_KEY, mode);
            renderFilePreview(currentFilePath, currentFileContent);
            updateEditorControls();
        }

        function renderFilePreview(filePath, content) {
            const renderArea = document.getElementById('detail-content-area');

            if (isMarkdownFile(filePath)) {
                if (markdownViewMode === 'source') {
                    renderArea.innerHTML = `
                    <pre class="markdown-source-view bg-slate-50 p-5 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 overflow-x-auto leading-relaxed whitespace-pre-wrap vscode-scrollbar"><code>${escapeHTML(content)}</code></pre>
                `;
                    return;
                }

                renderArea.innerHTML = `
                    <div class="prose prose-slate max-w-none space-y-4">
                        ${parseMarkdown(content)}
                    </div>
                `;
            } else {
                renderArea.innerHTML = `
                    <pre class="bg-slate-50 p-5 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 overflow-x-auto leading-relaxed whitespace-pre vscode-scrollbar"><code>${escapeHTML(content)}</code></pre>
                `;
            }
        }

        function renderFileEditor() {
            const renderArea = document.getElementById('detail-content-area');
            renderArea.innerHTML = `
                <textarea id="file-edit-textarea" spellcheck="false" class="w-full min-h-full resize-none bg-slate-950 text-slate-50 border border-slate-800 rounded-xl p-5 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 vscode-scrollbar">${escapeHTML(currentFileContent)}</textarea>
            `;
            document.getElementById('file-edit-textarea')?.focus();
        }

        function startFileEdit() {
            const skill = currentSkills.find(s => s.id === activeSkillId);

            if (!canCurrentAccountEditSkill(skill)) {
                showToast('본인이 만든 스킬 또는 Fork한 스킬만 수정할 수 있습니다.', 'error');
                return;
            }

            isEditingFile = true;
            renderFileEditor();
            updateEditorControls();
        }

        function cancelFileEdit() {
            isEditingFile = false;
            renderFilePreview(currentFilePath, currentFileContent);
            updateEditorControls();
        }

        async function saveFileEdit() {
            const textarea = document.getElementById('file-edit-textarea');
            if (!textarea || isSavingFile) return;

            isSavingFile = true;
            updateEditorControls();

            try {
                const response = await fetch(`/api/skills/${encodeURIComponent(activeSkillId)}/files`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountId: CURRENT_ACCOUNT.id,
                        accountName: CURRENT_ACCOUNT.name,
                        adminPassword: isAdminMode ? ADMIN_ACCESS_PASSWORD : undefined,
                        filePath: currentFilePath,
                        content: textarea.value
                    })
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload.error || `Skill file save failed with ${response.status}`);
                }

                replaceSkillInCatalog(payload.skill);
                currentFileContent = payload.content;
                isEditingFile = false;
                applyFilterAndSort();
                loadSkillDetail(payload.skill.id);
                loadWorkspaceFileByPath(payload.filePath);
                showToast(`${payload.filePath} 파일을 저장했습니다.`, 'success');
            } catch (error) {
                console.error(error);
                showToast(error.message || '파일 저장에 실패했습니다.', 'error');
            } finally {
                isSavingFile = false;
                updateEditorControls();
            }
        }

        // Load real skill files supplied by the backend catalog.
        function loadWorkspaceFileByPath(filePath) {
            isEditingFile = false;
            // Unhighlight all
            document.querySelectorAll('.tree-node').forEach(el => {
                el.classList.remove('bg-slate-200', 'text-slate-900');
            });

            // Highlight target
            const activeNode = document.getElementById(fileNodeId(filePath));
            if (activeNode) {
                activeNode.classList.add('bg-slate-200', 'text-slate-900');
            }

            // Update Tab name
            const filename = filePath.split('/').pop();
            document.getElementById('current-tab-name').textContent = filename;
            
            // Icon Switch
            const tabIcon = document.getElementById('current-tab-icon');
            tabIcon.setAttribute('data-lucide', iconForSkillFile(filePath));
            lucide.createIcons({ scope: tabIcon.parentElement });

            const skill = currentSkills.find(s => s.id === activeSkillId);
            const content = skill?.file_contents?.[filePath] || fallbackSkillFileContent(skill, filePath);
            currentFilePath = filePath;
            currentFileContent = content;

            renderFilePreview(filePath, content);
            updateEditorControls();
        }

        function fallbackSkillFileContent(skill, filePath) {
            if (!skill) return '/* 스킬을 찾을 수 없습니다. */';

            if (filePath === 'SKILL.md') {
                return `---\nname: ${skill.id}\ndescription: ${skill.short_description}\n---\n\n# ${skill.name}\n\n${skill.short_description}\n`;
            }

            if (filePath === 'skill.json') {
                const { file_contents, files, ...manifest } = skill;
                return JSON.stringify(manifest, null, 2);
            }

            return MOCK_FILE_CONTENTS.generic?.skill_md || '/* 파일 내용이 아직 등록되지 않았습니다. */';
        }

        function escapeHTML(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Extremely simplified client-side Markdown to HTML converter
        function parseMarkdown(text) {
            return text
                .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-extrabold text-slate-800 pb-2 border-b border-slate-200">$1</h1>')
                .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-700 mt-4">$1</h2>')
                .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-slate-700 mt-3 flex items-center gap-1.5">$1</h3>')
                .replace(/^#### (.*$)/gim, '<h4 class="text-xs font-bold text-indigo-600 tracking-wider uppercase mt-3">$1</h4>')
                .replace(/^\- (.*$)/gim, '<li class="text-xs text-slate-600 ml-4 list-disc">$1</li>')
                .replace(/^\d\.\s(.*$)/gim, '<li class="text-xs text-slate-600 ml-4 list-decimal">$1</li>')
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-850 font-semibold">$1</strong>')
                .replace(/\`(.*?)\`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600">$1</code>')
                .replace(/\n\n/g, '<p class="text-xs text-slate-600 leading-relaxed"></p>');
        }

        // Active header operations sim
        async function triggerAction(action) {
            const skill = currentSkills.find(s => s.id === activeSkillId);
            if (!skill) return;

            if (action === 'like') {
                skill.likes++;
                document.getElementById('detail-like-cnt').textContent = skill.likes;
                applyFilterAndSort();
                showToast(`[${skill.name}] 스킬에 좋아요를 등록했습니다.`, 'success');
            } else if (action === 'install') {
                if (canCurrentAccountDeleteDraftSkill(skill)) {
                    await deleteDraftSkillForCurrentAccount(skill);
                } else if (installedSkillIds.has(skill.id)) {
                    await uninstallSkillForCurrentAccount(skill);
                } else {
                    await installSkillForCurrentAccount(skill);
                }
                document.getElementById('detail-down-cnt').textContent = skill.downloads.toLocaleString();
            } else if (action === 'run') {
                skill.runs++;
                document.getElementById('detail-run-cnt').textContent = skill.runs.toLocaleString();
                applyFilterAndSort();
                showToast(`[가상 실행 성공] 입력 파라미터를 대조하여 1회 성공 처리를 집계했습니다!`, 'success');
            } else if (action === 'fork') {
                try {
                    const response = await fetch(`/api/skills/${encodeURIComponent(skill.id)}/fork`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accountId: CURRENT_ACCOUNT.id,
                            accountName: CURRENT_ACCOUNT.name,
                            accountTeam: CURRENT_ACCOUNT.team
                        })
                    });
                    const payload = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        throw new Error(payload.error || `Skill fork failed with ${response.status}`);
                    }

                    currentSkills.unshift(payload);
                    activeFilters = { ...defaultFilters, myDrafts: true };
                    currentSort = 'recent';
                    refreshCatalogResults();
                    pushCatalogHistory();
                    activeSkillId = payload.id;
                    loadSkillDetail(payload.id);
                    showToast(`[복제 완료] '${payload.name}' 사본을 내 Draft/Fork 목록에 만들었습니다.`, 'success');
                } catch (error) {
                    console.error(error);
                    showToast(error.message || '스킬 Fork에 실패했습니다.', 'error');
                }
            }
        }

        // REGISTRATION STEP FORM LOGIC
        function openRegisterModal() {
            currentRegStep = 1;
            document.getElementById('register-modal').classList.remove('hidden');
            renderRegStepUI();
        }

        function closeRegisterModal() {
            document.getElementById('register-modal').classList.add('hidden');
        }

        function handleRegStep(direction) {
            const nextStep = currentRegStep + direction;
            if (nextStep >= 1 && nextStep <= 6) {
                // Validation before moving
                if (currentRegStep === 1 && direction === 1) {
                    const name = document.getElementById('reg-name').value.trim();
                    const sdesc = document.getElementById('reg-short').value.trim();
                    if (!name || !sdesc) {
                        showToast('필수 기본 정보를 입력해 주세요.', 'error');
                        return;
                    }
                }
                
                if (currentRegStep === 5 && direction === 1) {
                    const agree = document.getElementById('reg-agreement').checked;
                    if (!agree) {
                        showToast('보안 서약 사항에 동의해야 마감할 수 있습니다.', 'error');
                        return;
                    }
                }

                currentRegStep = nextStep;
                renderRegStepUI();
            } else if (nextStep > 6) {
                finalizeRegistration();
            }
        }

        function renderRegStepUI() {
            // Hide all step sections
            for (let i = 1; i <= 6; i++) {
                document.getElementById(`reg-step-content-${i}`).classList.add('hidden');
                
                // Progress nodes styling reset
                const node = document.getElementById(`step-node-${i}`);
                const circle = node.querySelector('span');
                
                if (i < currentRegStep) {
                    // Passed steps
                    node.className = "flex items-center gap-1.5 text-emerald-600 font-semibold";
                    circle.className = "w-5 h-5 rounded-full bg-emerald-50 border border-emerald-450 flex items-center justify-center";
                    circle.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>`;
                } else if (i === currentRegStep) {
                    // Active step
                    node.className = "flex items-center gap-1.5 text-blue-600 font-bold";
                    circle.className = "w-5 h-5 rounded-full bg-blue-50 border border-blue-450 flex items-center justify-center";
                    circle.innerHTML = `${i}`;
                } else {
                    // Pending steps
                    node.className = "flex items-center gap-1.5 text-slate-400";
                    circle.className = "w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center";
                    circle.innerHTML = `${i}`;
                }

                // Line connection styling
                if (i < 6) {
                    const line = document.getElementById(`step-line-${i}`);
                    if (i < currentRegStep) {
                        line.className = "flex-1 h-0.5 bg-emerald-300";
                    } else {
                        line.className = "flex-1 h-0.5 bg-slate-200";
                    }
                }
            }

            // Show current content
            document.getElementById(`reg-step-content-${currentRegStep}`).classList.remove('hidden');

            // Button controls update
            const prevBtn = document.getElementById('reg-btn-prev');
            const nextBtn = document.getElementById('reg-btn-next');

            prevBtn.disabled = (currentRegStep === 1);
            
            if (currentRegStep === 6) {
                nextBtn.innerHTML = `게시완료 <i data-lucide="send" class="w-3.5 h-3.5"></i>`;
                nextBtn.className = "px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm";
            } else {
                nextBtn.innerHTML = `다음 단계 <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>`;
                nextBtn.className = "px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm";
            }

            lucide.createIcons();
        }

        // Mock test simulation inside Registration Form
        function executeMockRegistrationTest() {
            const runInd = document.getElementById('test-run-indicator');
            const stats = document.getElementById('test-result-stats');
            
            runInd.innerHTML = `<span class="text-blue-600 flex items-center gap-1.5"><i data-lucide="loader" class="w-4.5 h-4.5 animate-spin"></i> 로컬 테스트 케이스 빌드 및 검증 중...</span>`;
            lucide.createIcons({scope: runInd});

            setTimeout(() => {
                runInd.innerHTML = `🟢 <strong class="text-emerald-600">자가 테스트 통과 (SUCCESS)</strong>: 테스트 데이터 5개 입력 중 5개 포맷 성공 확인. 민감 보안 구문 탐지 안 됨.`;
                stats.classList.remove('hidden');
                showToast('자가 테스트 모의 검증을 통과했습니다!', 'success');
            }, 1500);
        }

        // Finalize Registration and persist as a skill package through the backend API
        async function finalizeRegistration() {
            const name = document.getElementById('reg-name').value;
            const short_desc = document.getElementById('reg-short').value;
            const category = document.getElementById('reg-category').value;
            const type = document.getElementById('reg-type').value;
            const tagsInput = document.getElementById('reg-tags').value;
            const visibilityOption = document.querySelector('input[name="reg-vis"]:checked').value;

            const skillDraft = {
                name: name,
                short_description: short_desc,
                owner: "오명철 과장",
                team: "경영기획DX추진TF팀",
                downloads: 0,
                likes: 0,
                runs: 0,
                success_rate: 100,
                quality_score: 90, 
                category: category,
                type: type,
                status: "Draft", 
                visibility: visibilityOption,
                version: "v1.0.0",
                updated_at: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
                tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean)
            };

            try {
                const response = await fetch('/api/skills', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(skillDraft)
                });
                if (!response.ok) {
                    throw new Error(`Skill save failed with ${response.status}`);
                }
                const savedSkill = await response.json();
                currentSkills.unshift(savedSkill);
                applyFilterAndSort();
                closeRegisterModal();
                showToast(`[${name}] 스킬 패키지가 저장되고 Draft 상태로 등록되었습니다.`, 'success');
            } catch (error) {
                console.error(error);
                showToast('스킬 패키지 저장에 실패했습니다. 서버 상태를 확인해 주세요.', 'error');
            }
        }
