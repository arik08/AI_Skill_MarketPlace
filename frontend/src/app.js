const MOCK_SKILLS = window.MOCK_SKILLS || [];
const MOCK_FILE_CONTENTS = window.MOCK_FILE_CONTENTS || {};

// Global States
        let currentSkills = [...MOCK_SKILLS];
        let activeFilters = {
            category: '전체',
            type: '전체',
            status: '전체',
            visibility: '전체',
            searchQuery: ''
        };
        let currentSort = 'recommended';
        let activeSkillId = 'skill-01'; // Default selected for Detail page
        let currentRegStep = 1;

        // On Page Load
        window.addEventListener('DOMContentLoaded', () => {
            // Initialize Lucide Icons
            lucide.createIcons();
            
            // Build filter panels
            buildFilterUI();
            
            // Initial Render of cards
            applyFilterAndSort();

            // Setup Details for default skill on startup
            loadSkillDetail('skill-01');
        });

        // Helper to show modern Toast messages without using window.alert
        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            
            const bgClass = {
                success: 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-lg',
                error: 'bg-rose-50 border-rose-200 text-rose-800 shadow-lg',
                info: 'bg-blue-50 border-blue-200 text-blue-800 shadow-lg'
            }[type];

            const iconName = {
                success: 'check-circle-2',
                error: 'alert-triangle',
                info: 'info'
            }[type];

            toast.className = `flex items-center gap-2.5 px-4 py-3.5 rounded-xl border ${bgClass} transition-all duration-300 transform translate-y-2 opacity-0 text-xs font-semibold max-w-sm`;
            toast.innerHTML = `
                <i data-lucide="${iconName}" class="w-4.5 h-4.5 shrink-0"></i>
                <div class="flex-1">${message}</div>
            `;
            
            container.appendChild(toast);
            lucide.createIcons({attrs: {"stroke-width": 2}, nameAttr: "data-lucide", scope: toast});

            // Trigger animation
            setTimeout(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            }, 50);

            // Hide and remove
            setTimeout(() => {
                toast.classList.add('translate-y-2', 'opacity-0');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 3000);
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

        // Render dynamic Filters Panel
        function buildFilterUI() {
            // Setup Categories
            const categories = ['전체', '투자관리', '사업관리', '경영기획', '재무', '구매', '설비', '법무', 'HR'];
            const catContainer = document.getElementById('filter-category');
            catContainer.innerHTML = categories.map(cat => `
                <button onclick="setFilter('category', '${cat}')" class="filter-btn text-left text-xs px-3 py-2 rounded-lg transition-all ${activeFilters.category === cat ? 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                    ${cat}
                </button>
            `).join('');

            // Setup Types
            const types = ['전체', '프롬프트형', '문서분석형', '데이터분석형', '보고서생성형', 'API연계형', 'MCP Tool형'];
            const typeContainer = document.getElementById('filter-type');
            typeContainer.innerHTML = types.map(t => `
                <button onclick="setFilter('type', '${t}')" class="filter-btn text-left text-xs px-3 py-2 rounded-lg transition-all ${activeFilters.type === t ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                    ${t}
                </button>
            `).join('');

            // Setup Statuses
            const statuses = ['전체', 'Official', 'Verified', 'Beta', 'Draft'];
            const statusContainer = document.getElementById('filter-status');
            statusContainer.innerHTML = statuses.map(st => {
                return `
                    <button onclick="setFilter('status', '${st}')" class="filter-btn text-left text-xs px-3 py-2 rounded-lg transition-all ${activeFilters.status === st ? 'bg-slate-200 text-slate-800 font-semibold border border-slate-300' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                        ${st === '전체' ? '전체' : `• ${st}`}
                    </button>
                `;
            }).join('');

            // Setup Visibility
            const visibilities = ['전체', '전사 공개', '부서 공개'];
            const visContainer = document.getElementById('filter-visibility');
            visContainer.innerHTML = visibilities.map(v => `
                <button onclick="setFilter('visibility', '${v}')" class="filter-btn text-left text-xs px-3 py-2 rounded-lg transition-all ${activeFilters.visibility === v ? 'bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}">
                    ${v}
                </button>
            `).join('');
        }

        // Apply filters dynamically and display
        function setFilter(key, value) {
            activeFilters[key] = value;
            buildFilterUI();
            applyFilterAndSort();
        }

        function resetFilters() {
            activeFilters = {
                category: '전체',
                type: '전체',
                status: '전체',
                visibility: '전체',
                searchQuery: ''
            };
            document.getElementById('main-search-input').value = '';
            buildFilterUI();
            applyFilterAndSort();
            showToast('필터가 모두 초기화되었습니다.', 'info');
        }

        function handleSearch() {
            const inputVal = document.getElementById('main-search-input').value.trim();
            activeFilters.searchQuery = inputVal;
            applyFilterAndSort();
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

            // 2. Category Filter
            if (activeFilters.category !== '전체') {
                filtered = filtered.filter(item => item.category === activeFilters.category);
            }

            // 3. Type Filter
            if (activeFilters.type !== '전체') {
                filtered = filtered.filter(item => item.type === activeFilters.type);
            }

            // 4. Status Filter
            if (activeFilters.status !== '전체') {
                filtered = filtered.filter(item => item.status === activeFilters.status);
            }

            // 5. Visibility Filter
            if (activeFilters.visibility !== '전체') {
                filtered = filtered.filter(item => item.visibility === activeFilters.visibility);
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
                        searchQuery: '검색어'
                    };
                    badgesHTML += `
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-slate-600 rounded-full text-xs border border-slate-200 shadow-sm">
                            <span class="text-slate-400 text-[10px] uppercase font-bold">${labelMapping[key]}:</span>
                            <strong>${value}</strong>
                            <button onclick="clearSpecificFilter('${key}')" class="text-slate-400 hover:text-slate-800 transition-colors">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </span>
                    `;
                }
            }

            container.innerHTML = badgesHTML;
            lucide.createIcons();
        }

        function clearSpecificFilter(key) {
            if (key === 'searchQuery') {
                document.getElementById('main-search-input').value = '';
            }
            activeFilters[key] = (key === 'searchQuery') ? '' : '전체';
            buildFilterUI();
            applyFilterAndSort();
        }

        function handleSort() {
            currentSort = document.getElementById('sort-select').value;
            applyFilterAndSort();
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

            grid.innerHTML = skills.map(skill => {
                // Status Badge styling for light theme
                let badgeClass = 'bg-slate-100 text-slate-600 border-slate-250';
                if (skill.status === 'Official') badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (skill.status === 'Verified') badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                if (skill.status === 'Beta') badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                if (skill.status === 'Draft') badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';

                return `
                    <div class="bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-2xl p-5 transition-all flex flex-col justify-between group relative overflow-hidden shadow-sm hover:shadow-md">
                        
                        <!-- Header Line with Icon / Status Badge -->
                        <div>
                            <div class="flex items-start justify-between gap-2 mb-3">
                                <div class="flex items-center gap-3">
                                    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-indigo-600 group-hover:text-indigo-700">
                                        <i data-lucide="${skill.icon || 'cpu'}" class="w-5 h-5"></i>
                                    </div>
                                    <div>
                                        <span class="inline-block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">${skill.type}</span>
                                        <h3 class="font-bold text-slate-800 transition-colors text-sm sm:text-base flex items-center gap-1.5">
                                            ${skill.name}
                                        </h3>
                                    </div>
                                </div>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}">
                                    ${skill.status}
                                </span>
                            </div>

                            <!-- Description -->
                            <p class="text-xs text-slate-500 leading-relaxed mb-4">
                                ${skill.short_description}
                            </p>

                            <!-- Tag pills -->
                            <div class="flex flex-wrap gap-1 mb-4">
                                ${skill.tags.slice(0, 4).map(tag => `
                                    <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md hover:bg-slate-200 transition-colors cursor-pointer">#${tag}</span>
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
                                <button onclick="quickAction('${skill.id}', 'install')" class="w-full py-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-semibold text-xs rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 border border-slate-200/50">
                                    <i data-lucide="download" class="w-3 h-3"></i> 설치
                                </button>
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

        // Quick download simulator from card
        function quickAction(skillId, type) {
            const skill = currentSkills.find(s => s.id === skillId);
            if (!skill) return;

            if (type === 'install') {
                skill.downloads++;
                applyFilterAndSort();
                showToast(`[${skill.name}] 스킬이 개인 AI 워크스페이스에 설치되었습니다!`, 'success');
            }
        }

        // View Mode 2: Skill Explorer Loading
        function viewSkillDetails(skillId) {
            activeSkillId = skillId;
            loadSkillDetail(skillId);
            switchView('detail');
        }

        // Populate VS Code style layout
        function loadSkillDetail(skillId) {
            const skill = currentSkills.find(s => s.id === skillId);
            if (!skill) return;

            // Header Elements update
            document.getElementById('detail-skill-name').innerHTML = `${skill.name}`;
            document.getElementById('detail-short-desc').textContent = skill.short_description;
            document.getElementById('detail-owner').textContent = `${skill.owner} / ${skill.team}`;
            document.getElementById('detail-version').textContent = skill.version;
            document.getElementById('detail-quality').textContent = `${skill.quality_score}점`;
            
            document.getElementById('detail-down-cnt').textContent = skill.downloads.toLocaleString();
            document.getElementById('detail-run-cnt').textContent = skill.runs.toLocaleString();
            document.getElementById('detail-like-cnt').textContent = skill.likes;
            document.getElementById('detail-success-rate').textContent = `${skill.success_rate}%`;

            // Status Badge (Light theme adjusted)
            const statusBadge = document.getElementById('detail-status-badge');
            statusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded border';
            if (skill.status === 'Official') statusBadge.className += ' bg-emerald-50 text-emerald-700 border-emerald-200';
            else if (skill.status === 'Verified') statusBadge.className += ' bg-blue-50 text-blue-700 border-blue-200';
            else statusBadge.className += ' bg-amber-50 text-amber-700 border-amber-200';
            statusBadge.textContent = skill.status;

            // Icon Header update
            const iconWrap = document.getElementById('detail-icon-wrapper');
            iconWrap.innerHTML = `<i data-lucide="${skill.icon || 'cpu'}" class="w-4 h-4 text-indigo-600"></i>`;

            // Sidebar Explorer Score Bar Update
            document.getElementById('quality-indicator-score').textContent = `${skill.quality_score}/100`;
            document.getElementById('quality-indicator-bar').style.width = `${skill.quality_score}%`;

            // Render Explorer Tree (VS Code-like file structure)
            renderExplorerTree(skill);

            // Load initial file (Default to README.md)
            loadWorkspaceFile('readme', 'README.md', 'file-text');
        }

        // Render Tree folders
        function renderExplorerTree(skill) {
            const container = document.getElementById('explorer-tree');
            
            // Build tree html nodes (light theme styling)
            container.innerHTML = `
                <!-- Overview Folder -->
                <div class="space-y-0.5">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> Overview
                    </div>
                    <div class="pl-2 pr-1">
                        <button onclick="loadWorkspaceFile('readme', 'README.md', 'file-text')" id="node-readme" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="file-text" class="w-3.5 h-3.5 text-blue-600"></i> README.md
                        </button>
                        <button onclick="loadWorkspaceFile('use_cases', 'use_cases.md', 'file-text')" id="node-use_cases" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="file-question" class="w-3.5 h-3.5 text-blue-600"></i> 사용 시나리오
                        </button>
                    </div>
                </div>

                <!-- Skill Definition Folder -->
                <div class="space-y-0.5 mt-2">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> Skill Definition
                    </div>
                    <div class="pl-2 pr-1">
                        <button onclick="loadWorkspaceFile('skill_yaml', 'skill.yaml', 'file-code')" id="node-skill_yaml" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="file-code" class="w-3.5 h-3.5 text-amber-600"></i> skill.yaml
                        </button>
                        <button onclick="loadWorkspaceFile('input_schema', 'input_schema.json', 'file-json')" id="node-input_schema" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="braces" class="w-3.5 h-3.5 text-teal-600"></i> input_schema.json
                        </button>
                    </div>
                </div>

                <!-- Prompts Folder -->
                <div class="space-y-0.5 mt-2">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> Prompts
                    </div>
                    <div class="pl-2 pr-1">
                        <button onclick="loadWorkspaceFile('system_prompt', 'system_prompt.md', 'terminal')" id="node-system_prompt" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="terminal" class="w-3.5 h-3.5 text-purple-600"></i> system_prompt.md
                        </button>
                    </div>
                </div>

                <!-- Tools/Code Folder -->
                <div class="space-y-0.5 mt-2">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> Tools & Logic
                    </div>
                    <div class="pl-2 pr-1">
                        <button onclick="loadWorkspaceFile('npv_calculator', 'calculator_tool.py', 'code')" id="node-npv_calculator" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="code" class="w-3.5 h-3.5 text-sky-600"></i> calculator_tool.py
                        </button>
                    </div>
                </div>

                <!-- Examples Folder -->
                <div class="space-y-0.5 mt-2">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> Examples
                    </div>
                    <div class="pl-2 pr-1">
                        <button onclick="loadWorkspaceFile('example_input', 'example_input_01.json', 'file-input')" id="node-example_input" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="indent-decrease" class="w-3.5 h-3.5 text-emerald-600"></i> input_sample.json
                        </button>
                        <button onclick="loadWorkspaceFile('example_output', 'example_output_01.md', 'file-output')" id="node-example_output" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="log-out" class="w-3.5 h-3.5 text-teal-600"></i> output_sample.md
                        </button>
                    </div>
                </div>

                <!-- Tests Folder -->
                <div class="space-y-0.5 mt-2">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> Tests
                    </div>
                    <div class="pl-2 pr-1">
                        <button onclick="loadWorkspaceFile('test_cases', 'test_cases.json', 'shield')" id="node-test_cases" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="shield-check" class="w-3.5 h-3.5 text-rose-600"></i> test_cases.json
                        </button>
                    </div>
                </div>

                <!-- Analytics Folder -->
                <div class="space-y-0.5 mt-2">
                    <div class="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i> Analytics
                    </div>
                    <div class="pl-2 pr-1">
                        <button onclick="loadWorkspaceFile('analytics', 'usage_dashboard.md', 'bar-chart')" id="node-analytics" class="tree-node w-full text-left py-1 px-3 hover:bg-slate-200/50 rounded text-slate-600 flex items-center gap-1.5 text-xs">
                            <i data-lucide="bar-chart-3" class="w-3.5 h-3.5 text-indigo-600"></i> usage_dashboard.md
                        </button>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }

        // Simulated file loading with markdown styling & YAML formatting
        function loadWorkspaceFile(fileType, filename, iconName) {
            // Unhighlight all
            document.querySelectorAll('.tree-node').forEach(el => {
                el.classList.remove('bg-slate-200', 'text-slate-900', 'font-semibold');
            });

            // Highlight target
            const activeNode = document.getElementById(`node-${fileType}`);
            if (activeNode) {
                activeNode.classList.add('bg-slate-200', 'text-slate-900', 'font-semibold');
            }

            // Update Tab name
            document.getElementById('current-tab-name').textContent = filename;
            
            // Icon Switch
            const tabIcon = document.getElementById('current-tab-icon');
            tabIcon.setAttribute('data-lucide', iconName || 'file-text');
            lucide.createIcons({ scope: tabIcon.parentElement });

            // Fetch mock content
            let content = '';
            if (MOCK_FILE_CONTENTS[activeSkillId] && MOCK_FILE_CONTENTS[activeSkillId][fileType]) {
                content = MOCK_FILE_CONTENTS[activeSkillId][fileType];
            } else {
                content = MOCK_FILE_CONTENTS['generic'][fileType] || '/* 빈 내용 또는 구성 파일 누락 */';
            }

            // Build pretty styled content inside right body
            const renderArea = document.getElementById('detail-content-area');

            if (filename.endsWith('.md')) {
                renderArea.innerHTML = `
                    <div class="prose prose-slate max-w-none space-y-4">
                        ${parseMarkdown(content)}
                    </div>
                `;
            } else {
                // Code view block
                renderArea.innerHTML = `
                    <pre class="bg-slate-50 p-5 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 overflow-x-auto leading-relaxed whitespace-pre vscode-scrollbar"><code>${escapeHTML(content)}</code></pre>
                `;
            }
        }

        function escapeHTML(str) {
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        function triggerAction(action) {
            const skill = currentSkills.find(s => s.id === activeSkillId);
            if (!skill) return;

            if (action === 'like') {
                skill.likes++;
                document.getElementById('detail-like-cnt').textContent = skill.likes;
                applyFilterAndSort();
                showToast(`[${skill.name}] 스킬에 좋아요를 등록했습니다.`, 'success');
            } else if (action === 'install') {
                skill.downloads++;
                document.getElementById('detail-down-cnt').textContent = skill.downloads.toLocaleString();
                applyFilterAndSort();
                showToast(`[${skill.name}] 스킬이 개인 계정에 마운트 완료되었습니다.`, 'success');
            } else if (action === 'run') {
                skill.runs++;
                document.getElementById('detail-run-cnt').textContent = skill.runs.toLocaleString();
                applyFilterAndSort();
                showToast(`[가상 실행 성공] 입력 파라미터를 대조하여 1회 성공 처리를 집계했습니다!`, 'success');
            } else if (action === 'fork') {
                showToast(`[복제 분기] '${skill.name} (Forked)' 사본을 내 Draft 임시저장소로 이전했습니다.`, 'info');
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

        // Finalize Registration and push to In-Memory DB
        function finalizeRegistration() {
            const name = document.getElementById('reg-name').value;
            const short_desc = document.getElementById('reg-short').value;
            const category = document.getElementById('reg-category').value;
            const type = document.getElementById('reg-type').value;
            const tagsInput = document.getElementById('reg-tags').value;
            const visibilityOption = document.querySelector('input[name="reg-vis"]:checked').value;

            const newSkill = {
                id: `skill-${Date.now()}`,
                name: name,
                short_description: short_desc,
                owner: "박민우", 
                team: "경영기획DX추진TF팀",
                downloads: 1,
                likes: 0,
                runs: 1,
                success_rate: 100,
                quality_score: 90, 
                category: category,
                type: type,
                status: "Draft", 
                visibility: visibilityOption,
                version: "v1.0.0",
                updated_at: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
                tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
                icon: "sparkles"
            };

            currentSkills.unshift(newSkill);
            
            applyFilterAndSort();
            closeRegisterModal();
            showToast(`[${name}] 스킬이 Draft 상태로 마켓플레이스에 정상 배포 신청되었습니다!`, 'success');
        }
