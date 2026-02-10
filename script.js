import * as Ext from './js/extractors.js';
import * as Compat from './js/compatibility.js';

async function loadData() {
    const [specsResp, hwResp] = await Promise.all([
        fetch('data/specs.json'),
        fetch('data/hardware.json')
    ]);
    const specs = await specsResp.json();
    const hardware = await hwResp.json();
    Ext.configure(specs, hardware);
}

class CompatibilityChecker {
    constructor() {
        this.clearButton = document.getElementById('clear-all');
        this.exportButton = document.getElementById('export-build');
        this.importButton = document.getElementById('import-build');
        this.importFile = document.getElementById('import-file');
        this.components = new Map();
        this.currentMode = 'simple';
        this.storageCounter = 0;
        this.memoryCounter = 0;
        this.initEventListeners();
        this.initModeToggle();
        this.initDragAndDrop();
        this.loadFromCache();
    }

    initEventListeners() {
        document.querySelectorAll('.component-input').forEach(input => {
            input.addEventListener('input', (e) => this.handleInputChange(e));
            input.addEventListener('blur', (e) => this.handleComponentInput(e));
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') e.target.blur(); });
        });
        this.clearButton.addEventListener('click', () => this.clearAllComponents());
        this.exportButton.addEventListener('click', () => this.exportBuild());
        this.importButton.addEventListener('click', () => this.importFile.click());
        this.importFile.addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('add-storage').addEventListener('click', () => this.addStorageInput());
        document.getElementById('add-memory').addEventListener('click', () => this.addMemoryInput());
    }

    initModeToggle() {
        const simpleModeBtn = document.getElementById('simple-mode');
        const expertModeBtn = document.getElementById('expert-mode');
        if (simpleModeBtn && expertModeBtn) {
            simpleModeBtn.addEventListener('click', () => this.switchMode('simple'));
            expertModeBtn.addEventListener('click', () => this.switchMode('expert'));
        }
    }

    initDragAndDrop() {
        document.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); document.body.classList.add('dragging'); });
        document.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (e.clientX === 0 && e.clientY === 0) document.body.classList.remove('dragging'); });
        document.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation(); document.body.classList.remove('dragging');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/json') this.handleFileDrop(files[0]);
        });
    }

    isValidProductCode(code) { return /^\d{5,7}$/.test(code); }

    _errorHtml(message) {
        return `<div style="color:var(--alert-red);background:rgba(226,0,0,0.1);padding:8px;border-radius:4px;font-size:0.85em;border-left:3px solid var(--alert-red);">${message}</div>`;
    }

    switchMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`${mode}-mode`);
        if (activeBtn) activeBtn.classList.add('active');
        this.refreshAllDisplays();
        this.saveToCache();
    }

    refreshAllDisplays() {
        this.components.forEach((component, type) => {
            if (!type.startsWith('storage-') && !type.startsWith('memory-')) {
                this.updateComponentDisplay(type, component);
            }
        });
        for (let i = 1; i <= this.storageCounter; i++) {
            if (this.components.has(`storage-${i}`)) this.updateAdditionalStorageDisplay(i, this.components.get(`storage-${i}`));
        }
        for (let i = 1; i <= this.memoryCounter; i++) {
            if (this.components.has(`memory-${i}`)) this.updateAdditionalMemoryDisplay(i, this.components.get(`memory-${i}`));
        }
    }

    saveToCache() {
        const cacheData = {
            components: Array.from(this.components.entries()).map(([type, data]) => ({
                type, name: data.name, productCode: data.productCode, category: data.category, specs: data.specs
            })),
            mode: this.currentMode,
            storageCounter: this.storageCounter,
            timestamp: new Date().toISOString()
        };
        try { localStorage.setItem('pc-build-cache', JSON.stringify(cacheData)); }
        catch (e) { console.warn('Failed to save to cache:', e); }
    }

    async loadFromCache() {
        try {
            const cached = localStorage.getItem('pc-build-cache');
            if (!cached) return;
            const cacheData = JSON.parse(cached);
            if (Date.now() - new Date(cacheData.timestamp).getTime() > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('pc-build-cache');
                return;
            }
            this.currentMode = cacheData.mode || 'simple';
            this.switchMode(this.currentMode);
            this.storageCounter = cacheData.storageCounter || 0;
            if (cacheData.components && cacheData.components.length > 0) {
                for (const component of cacheData.components) await this.restoreComponent(component);
                this.updateBuildSummary();
                this.checkRealTimeCompatibility();
            }
        } catch (e) {
            console.warn('Failed to load from cache:', e);
            localStorage.removeItem('pc-build-cache');
        }
    }

    async restoreComponent({ type, productCode }) {
        try {
            if (type.startsWith('storage-')) {
                const id = parseInt(type.replace('storage-', ''));
                while (this.storageCounter < id) this.addStorageInput();
                const input = document.getElementById(`${type}-input`);
                if (input) { input.value = productCode; await this.handleAdditionalStorageInput({ target: input }); }
            } else if (type.startsWith('memory-')) {
                const id = parseInt(type.replace('memory-', ''));
                while (this.memoryCounter < id) this.addMemoryInput();
                const input = document.getElementById(`${type}-input`);
                if (input) { input.value = productCode; await this.handleAdditionalMemoryInput({ target: input }); }
            } else {
                const input = document.getElementById(`${type}-input`);
                if (input) { input.value = productCode; await this.handleComponentInput({ target: input }); }
            }
        } catch (e) { console.warn(`Failed to restore component ${type}:`, e); }
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (file) this.handleFileDrop(file);
        event.target.value = '';
    }

    async handleFileDrop(file) {
        try {
            const text = await file.text();
            const buildData = JSON.parse(text);
            if (!buildData.components || !Array.isArray(buildData.components)) throw new Error('Virheellinen tiedostomuoto');
            this.clearAllComponents();
            for (const component of buildData.components) await this.importComponent(component);
            if (buildData.mode) this.switchMode(buildData.mode);
            this.updateBuildSummary();
            this.checkRealTimeCompatibility();
            this.saveToCache();
            this.showNotification('Kokoonpano tuotu onnistuneesti!', 'success');
        } catch (error) {
            console.error('Import failed:', error);
            this.showNotification('Tiedoston tuonti epäonnistui: ' + error.message, 'error');
        }
    }

    async importComponent({ type, productCode }) {
        try {
            if (type.startsWith('storage-') && type !== 'storage') {
                const id = parseInt(type.replace('storage-', ''));
                while (this.storageCounter < id) this.addStorageInput();
            }
            if (type.startsWith('memory-') && type !== 'memory') {
                const id = parseInt(type.replace('memory-', ''));
                while (this.memoryCounter < id) this.addMemoryInput();
            }
            const input = document.getElementById(`${type}-input`);
            if (input) {
                input.value = productCode;
                if (type.startsWith('storage-') && type !== 'storage') await this.handleAdditionalStorageInput({ target: input });
                else if (type.startsWith('memory-') && type !== 'memory') await this.handleAdditionalMemoryInput({ target: input });
                else await this.handleComponentInput({ target: input });
            }
        } catch (e) { console.warn(`Failed to import component ${type}:`, e); }
    }

    exportBuild() {
        if (this.components.size === 0) { this.showNotification('Ei komponentteja vietäväksi', 'error'); return; }
        const buildData = {
            components: Array.from(this.components.entries()).map(([type, data]) => ({
                type, name: data.name, productCode: data.productCode, category: data.category, specs: data.specs
            })),
            mode: this.currentMode,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        const blob = new Blob([JSON.stringify(buildData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pc-build-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        this.showNotification('Kokoonpano viety onnistuneesti!', 'success');
    }

    showNotification(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.textContent = message;
        el.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:6px;color:white;font-weight:500;z-index:1000;max-width:300px;word-wrap:break-word;background:${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:translateX(100%);transition:transform 0.3s ease;`;
        document.body.appendChild(el);
        setTimeout(() => { el.style.transform = 'translateX(0)'; }, 100);
        setTimeout(() => { el.style.transform = 'translateX(100%)'; setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300); }, 3000);
    }

    handleInputChange(event) {
        const input = event.target;
        const productCode = input.value.trim();
        if (input.autoSubmitTimeout) clearTimeout(input.autoSubmitTimeout);
        input.autoSubmitTimeout = setTimeout(() => {
            if (this.isValidProductCode(productCode)) this.handleComponentInput(event);
        }, 500);
    }

    handleAdditionalInputChange(event) {
        const input = event.target;
        const productCode = input.value.trim();
        if (input.autoSubmitTimeout) clearTimeout(input.autoSubmitTimeout);
        input.autoSubmitTimeout = setTimeout(() => {
            if (this.isValidProductCode(productCode)) {
                if (input.getAttribute('data-storage-id')) this.handleAdditionalStorageInput(event);
                else if (input.getAttribute('data-memory-id')) this.handleAdditionalMemoryInput(event);
            }
        }, 500);
    }

    async handleComponentInput(event) {
        const input = event.target;
        const productCode = input.value.trim();
        const componentType = input.id.replace('-input', '');
        if (!productCode) { this.clearComponent(componentType); return; }
        if (!this.isValidProductCode(productCode)) { this.setComponentError(componentType, 'Tuotekoodi on 5-7 numeroa (esim. 123456)'); return; }
        this.setComponentLoading(componentType, true);
        try {
            const response = await fetch(`/pc/api/product/${productCode}`);
            if (!response.ok) throw new Error(response.status === 404 ? 'Tuotetta ei löytynyt' : `Palvelinvirhe: ${response.status}`);
            const productData = await response.json();
            const validation = Compat.validateComponentPlacement(componentType, productData);
            if (!validation.valid) throw new Error(validation.message);
            this.addComponent(componentType, productData);
            this.updateComponentDisplay(componentType, productData);
            if (componentType === 'cpu') this.updateCoolerRequirement(productData);
            this.updateBuildSummary();
            this.checkRealTimeCompatibility();
            this.saveToCache();
        } catch (error) {
            this.setComponentError(componentType, error.message);
        } finally {
            this.setComponentLoading(componentType, false);
        }
    }

    async handleAdditionalStorageInput(event) {
        const input = event.target;
        const productCode = input.value.trim();
        const storageId = input.getAttribute('data-storage-id');
        const componentType = `storage-${storageId}`;
        if (!productCode) { this.clearComponent(componentType); return; }
        if (!this.isValidProductCode(productCode)) { this.setAdditionalStorageError(storageId, 'Tuotekoodi on 5-7 numeroa'); return; }
        this.setAdditionalStorageLoading(storageId, true);
        try {
            const response = await fetch(`/pc/api/product/${productCode}`);
            if (!response.ok) throw new Error(response.status === 404 ? 'Tuotetta ei löytynyt' : `Palvelinvirhe: ${response.status}`);
            const productData = await response.json();
            if (Ext.determineActualCategory(productData) !== 'storage') throw new Error(`"${productData.name}" ei ole tallennustila. Valitse SSD tai HDD.`);
            this.addComponent(componentType, productData);
            this.updateAdditionalStorageDisplay(storageId, productData);
            this.updateBuildSummary();
            this.checkRealTimeCompatibility();
            this.saveToCache();
        } catch (error) {
            this.setAdditionalStorageError(storageId, error.message);
        } finally {
            this.setAdditionalStorageLoading(storageId, false);
        }
    }

    async handleAdditionalMemoryInput(event) {
        const input = event.target;
        const productCode = input.value.trim();
        const memoryId = input.getAttribute('data-memory-id');
        const componentType = `memory-${memoryId}`;
        if (!productCode) { this.clearComponent(componentType); return; }
        if (!this.isValidProductCode(productCode)) { this.setAdditionalMemoryError(memoryId, 'Tuotekoodi on 5-7 numeroa'); return; }
        this.setAdditionalMemoryLoading(memoryId, true);
        try {
            const response = await fetch(`/pc/api/product/${productCode}`);
            if (!response.ok) throw new Error(response.status === 404 ? 'Tuotetta ei löytynyt' : `Palvelinvirhe: ${response.status}`);
            const productData = await response.json();
            if (Ext.determineActualCategory(productData) !== 'memory') throw new Error(`"${productData.name}" ei ole muisti. Valitse RAM-muisti.`);
            this.addComponent(componentType, productData);
            this.updateAdditionalMemoryDisplay(memoryId, productData);
            this.updateBuildSummary();
            this.checkRealTimeCompatibility();
            this.saveToCache();
        } catch (error) {
            this.setAdditionalMemoryError(memoryId, error.message);
        } finally {
            this.setAdditionalMemoryLoading(memoryId, false);
        }
    }

    addStorageInput() {
        this.storageCounter++;
        const container = document.querySelector('[data-component="storage"] .component-selector');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'additional-storage';
        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
                <input type="text" placeholder="Lisää tallennustila" class="component-input additional-storage-input" id="storage-${this.storageCounter}-input" data-storage-id="${this.storageCounter}">
                <button type="button" class="remove-storage-btn" data-storage-id="${this.storageCounter}">x</button>
            </div>
            <div class="component-display" id="storage-${this.storageCounter}-display" style="display:none;"></div>
        `;
        container.insertBefore(div, document.getElementById('add-storage'));
        const newInput = div.querySelector('.additional-storage-input');
        const removeBtn = div.querySelector('.remove-storage-btn');
        newInput.addEventListener('input', (e) => this.handleAdditionalInputChange(e));
        newInput.addEventListener('blur', (e) => this.handleAdditionalStorageInput(e));
        newInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') e.target.blur(); });
        removeBtn.addEventListener('click', () => this.removeStorageInput(removeBtn.getAttribute('data-storage-id')));
    }

    addMemoryInput() {
        this.memoryCounter++;
        const container = document.querySelector('[data-component="memory"] .component-selector');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'additional-memory';
        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
                <input type="text" placeholder="Lisää muisti" class="component-input additional-memory-input" id="memory-${this.memoryCounter}-input" data-memory-id="${this.memoryCounter}">
                <button type="button" class="remove-memory-btn" data-memory-id="${this.memoryCounter}">x</button>
            </div>
            <div class="component-display" id="memory-${this.memoryCounter}-display" style="display:none;"></div>
        `;
        container.insertBefore(div, document.getElementById('add-memory'));
        const newInput = div.querySelector('.additional-memory-input');
        const removeBtn = div.querySelector('.remove-memory-btn');
        newInput.addEventListener('input', (e) => this.handleAdditionalInputChange(e));
        newInput.addEventListener('blur', (e) => this.handleAdditionalMemoryInput(e));
        newInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') e.target.blur(); });
        removeBtn.addEventListener('click', () => this.removeMemoryInput(removeBtn.getAttribute('data-memory-id')));
    }

    removeStorageInput(storageId) {
        const el = document.querySelector(`[data-storage-id="${storageId}"]`)?.closest('.additional-storage');
        if (el) el.remove();
        this.components.delete(`storage-${storageId}`);
        this.updateBuildSummary();
        this.checkRealTimeCompatibility();
        this.saveToCache();
    }

    removeMemoryInput(memoryId) {
        const el = document.querySelector(`[data-memory-id="${memoryId}"]`)?.closest('.additional-memory');
        if (el) el.remove();
        this.components.delete(`memory-${memoryId}`);
        this.updateBuildSummary();
        this.checkRealTimeCompatibility();
        this.saveToCache();
    }

    addComponent(componentType, productData) {
        this.components.set(componentType, productData);
        const card = document.querySelector(`[data-component="${componentType}"]`);
        if (card) {
            const icon = card.querySelector('.status-icon');
            if (icon) icon.textContent = '';
            card.classList.add('filled');
            card.classList.remove('error');
        }
    }

    clearComponent(componentType) {
        this.components.delete(componentType);
        if (componentType.startsWith('storage-')) {
            const id = componentType.replace('storage-', '');
            const el = document.querySelector(`[data-storage-id="${id}"]`)?.closest('.additional-storage');
            if (el) { el.classList.remove('filled', 'error'); const d = document.getElementById(`${componentType}-display`); if (d) d.style.display = 'none'; }
        } else if (componentType.startsWith('memory-')) {
            const id = componentType.replace('memory-', '');
            const el = document.querySelector(`[data-memory-id="${id}"]`)?.closest('.additional-memory');
            if (el) { el.classList.remove('filled', 'error'); const d = document.getElementById(`${componentType}-display`); if (d) d.style.display = 'none'; }
        } else {
            const card = document.querySelector(`[data-component="${componentType}"]`);
            if (card) {
                const icon = card.querySelector('.status-icon');
                const display = document.getElementById(`${componentType}-display`);
                if (icon) icon.textContent = '';
                card.classList.remove('filled', 'error');
                if (display) display.style.display = 'none';
            }
        }
        if (componentType === 'cpu') {
            const coolerCard = document.getElementById('cooler-card');
            const tag = document.getElementById('cooler-optional-tag');
            if (coolerCard) coolerCard.classList.remove('optional');
            if (tag) tag.style.display = 'none';
        }
        this.updateBuildSummary();
        this.checkRealTimeCompatibility();
        this.saveToCache();
    }

    clearAllComponents() {
        document.querySelectorAll('.component-input').forEach(i => { i.value = ''; });
        document.querySelectorAll('.additional-storage').forEach(el => el.remove());
        document.querySelectorAll('.additional-memory').forEach(el => el.remove());
        this.storageCounter = 0;
        this.memoryCounter = 0;
        this.components.clear();
        document.querySelectorAll('.component-card').forEach(card => {
            const icon = card.querySelector('.status-icon');
            if (icon) icon.textContent = '';
            card.classList.remove('filled', 'error');
        });
        document.querySelectorAll('.component-display').forEach(d => { d.style.display = 'none'; });
        const coolerCard = document.getElementById('cooler-card');
        const tag = document.getElementById('cooler-optional-tag');
        if (coolerCard) coolerCard.classList.remove('optional');
        if (tag) tag.style.display = 'none';
        this.updateBuildSummary();
        this.updateCompatibilityStatus('pending', 'Odottaa');
        this.updatePowerEstimate(0);
        const ip = document.getElementById('issues-panel');
        const sp = document.getElementById('suggestions-panel');
        if (ip) ip.style.display = 'none';
        if (sp) sp.style.display = 'none';
        localStorage.removeItem('pc-build-cache');
    }

    setComponentLoading(componentType, loading) {
        const card = document.querySelector(`[data-component="${componentType}"]`);
        if (!card) return;
        const icon = card.querySelector('.status-icon');
        if (loading) { if (icon) icon.textContent = ''; card.classList.add('loading'); }
        else card.classList.remove('loading');
    }

    setComponentError(componentType, errorMessage) {
        const card = document.querySelector(`[data-component="${componentType}"]`);
        if (!card) return;
        const icon = card.querySelector('.status-icon');
        const display = document.getElementById(`${componentType}-display`);
        const input = document.getElementById(`${componentType}-input`);
        if (icon) icon.textContent = '';
        card.classList.add('error');
        card.classList.remove('filled');
        if ((errorMessage.includes('ei ole ') || errorMessage.includes('on tarkoitettu')) && input) input.value = '';
        if (display) { display.innerHTML = this._errorHtml(errorMessage); display.style.display = 'block'; }
        this.components.delete(componentType);
        this.updateBuildSummary();
        this.checkRealTimeCompatibility();
    }

    setAdditionalStorageLoading(storageId, loading) {
        const el = document.querySelector(`[data-storage-id="${storageId}"]`)?.closest('.additional-storage');
        if (el) { if (loading) el.classList.add('loading'); else el.classList.remove('loading'); }
    }

    setAdditionalStorageError(storageId, errorMessage) {
        const el = document.querySelector(`[data-storage-id="${storageId}"]`)?.closest('.additional-storage');
        const input = document.getElementById(`storage-${storageId}-input`);
        const display = document.getElementById(`storage-${storageId}-display`);
        if (el) { el.classList.add('error'); el.classList.remove('filled'); }
        if (errorMessage.includes('ei ole ') || errorMessage.includes('on tarkoitettu')) input.value = '';
        if (display) { display.innerHTML = this._errorHtml(errorMessage); display.style.display = 'block'; }
        this.components.delete(`storage-${storageId}`);
        this.updateBuildSummary();
        this.checkRealTimeCompatibility();
    }

    setAdditionalMemoryLoading(memoryId, loading) {
        const el = document.querySelector(`[data-memory-id="${memoryId}"]`)?.closest('.additional-memory');
        if (el) { if (loading) el.classList.add('loading'); else el.classList.remove('loading'); }
    }

    setAdditionalMemoryError(memoryId, errorMessage) {
        const el = document.querySelector(`[data-memory-id="${memoryId}"]`)?.closest('.additional-memory');
        const input = document.getElementById(`memory-${memoryId}-input`);
        const display = document.getElementById(`memory-${memoryId}-display`);
        if (el) { el.classList.add('error'); el.classList.remove('filled'); }
        if (errorMessage.includes('ei ole ') || errorMessage.includes('on tarkoitettu')) input.value = '';
        if (display) { display.innerHTML = this._errorHtml(errorMessage); display.style.display = 'block'; }
        this.components.delete(`memory-${memoryId}`);
        this.updateBuildSummary();
        this.checkRealTimeCompatibility();
    }

    updateComponentDisplay(componentType, productData) {
        const display = document.getElementById(`${componentType}-display`);
        if (!display) return;
        display.innerHTML = this.currentMode === 'simple' ? this.formatSimpleDisplay(productData) : this.formatExpertDisplay(productData);
        display.style.display = 'block';
    }

    updateAdditionalStorageDisplay(storageId, productData) {
        const display = document.getElementById(`storage-${storageId}-display`);
        const el = document.querySelector(`[data-storage-id="${storageId}"]`)?.closest('.additional-storage');
        if (el) { el.classList.add('filled'); el.classList.remove('error'); }
        if (display) {
            display.innerHTML = this.currentMode === 'simple' ? this.formatSimpleDisplay(productData) : this.formatExpertDisplay(productData);
            display.style.display = 'block';
        }
    }

    updateAdditionalMemoryDisplay(memoryId, productData) {
        const display = document.getElementById(`memory-${memoryId}-display`);
        const el = document.querySelector(`[data-memory-id="${memoryId}"]`)?.closest('.additional-memory');
        if (el) { el.classList.add('filled'); el.classList.remove('error'); }
        if (display) {
            display.innerHTML = this.currentMode === 'simple' ? this.formatSimpleDisplay(productData) : this.formatExpertDisplay(productData);
            display.style.display = 'block';
        }
    }

    formatSimpleDisplay(productData) {
        const keySpecs = Ext.getCategoryKeySpecs(productData);
        const specsHtml = keySpecs.length > 0 ? keySpecs.map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('') : '';
        return `<h4>${productData.name}</h4>${specsHtml}`;
    }

    formatExpertDisplay(productData) {
        const importantSpecs = Ext.getImportantSpecs(productData.specs || {});
        let specsHtml;
        if (importantSpecs.length > 0) {
            specsHtml = importantSpecs.map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('');
        } else if (productData.specs && Object.keys(productData.specs).length > 0) {
            const filtered = Ext.filterRelevantSpecs(Object.entries(productData.specs));
            specsHtml = filtered.slice(0, 8).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('');
        } else {
            specsHtml = '<p style="color:var(--text-light);">Ei teknisiä tietoja saatavilla</p>';
        }
        return `<h4>${productData.name}</h4><div style="margin-top:8px;font-size:0.75em;">${specsHtml}</div>`;
    }

    updateBuildSummary() {
        const container = document.getElementById('build-summary');
        if (!container) return;
        if (this.components.size === 0) {
            container.innerHTML = '<div class="summary-item empty"><span>Valitse komponentteja aloittaaksesi</span></div>';
            if (this.exportButton) this.exportButton.disabled = true;
            return;
        }
        let html = '';
        this.components.forEach((component, type) => {
            const displayName = type.startsWith('storage-') ? `Tallennustila ${type.replace('storage-', '')}` :
                type.startsWith('memory-') ? `Muisti ${type.replace('memory-', '')}` :
                Ext.getCategoryDisplayName(component.category);
            html += `<div class="summary-item"><strong>${displayName}:</strong><br><span style="font-size:0.75em;">${component.name}</span></div>`;
        });
        container.innerHTML = html;
        if (this.exportButton) this.exportButton.disabled = this.components.size < 3;
    }

    updateCoolerRequirement(cpuData) {
        const coolerCard = document.getElementById('cooler-card');
        const tag = document.getElementById('cooler-optional-tag');
        if (!coolerCard || !tag) return;
        const included = Compat.checkIfCPUIncludesCooler(cpuData);
        coolerCard.classList.toggle('optional', included);
        tag.style.display = included ? 'inline-block' : 'none';
    }

    checkRealTimeCompatibility() {
        if (this.components.size < 2) {
            this.updateCompatibilityStatus('pending', 'Odottaa');
            this.displaySuggestions(Compat.generateSuggestions(this.components, this.memoryCounter, this.storageCounter));
            return;
        }
        const results = Compat.runAllCompatibilityChecks(this.components, this.memoryCounter, this.storageCounter);
        this.displayCompatibilityResults(results);
        this.displaySuggestions(Compat.generateSuggestions(this.components, this.memoryCounter, this.storageCounter));
    }

    updateCompatibilityStatus(status, text) {
        const el = document.querySelector('#live-compatibility .status-value');
        if (el) { el.className = `status-value ${status}`; el.textContent = text; }
    }

    updatePowerEstimate(power) {
        const el = document.getElementById('power-estimate');
        if (el) el.textContent = `${power}W`;
    }

    displayCompatibilityResults({ compatible, issues, estimatedPower }) {
        this.updateCompatibilityStatus(compatible ? 'compatible' : 'incompatible', compatible ? 'Yhteensopiva' : 'Ei yhteensopiva');
        if (estimatedPower) this.updatePowerEstimate(estimatedPower);
        if (issues && issues.length > 0) this.displayIssues(issues);
        else { const ip = document.getElementById('issues-panel'); if (ip) ip.style.display = 'none'; }
    }

    displayIssues(issues) {
        const panel = document.getElementById('issues-panel');
        const container = document.getElementById('live-issues');
        if (!panel || !container) return;
        if (issues.length === 0) { panel.style.display = 'none'; return; }
        container.innerHTML = issues.map(issue => {
            const css = issue.includes('KRIITTINEN') ? 'issue-critical' : 'issue-warning';
            return `<div class="${css}">${issue}</div>`;
        }).join('');
        panel.style.display = 'block';
    }

    displaySuggestions(suggestions) {
        const panel = document.getElementById('suggestions-panel');
        const container = document.getElementById('smart-suggestions');
        if (!panel || !container) return;
        if (suggestions.length === 0) { panel.style.display = 'none'; return; }
        container.innerHTML = suggestions.map(s => `<div>${s}</div>`).join('');
        panel.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    new CompatibilityChecker();
});
