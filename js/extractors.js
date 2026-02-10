let _specs = null;
let _hardware = null;

export function configure(specsConfig, hardwareData) {
    _specs = specsConfig;
    _hardware = hardwareData;
}

export function normalizeSocket(socket) {
    return socket.replace(/\s+/g, '').toUpperCase();
}

export function extractCPUSocket(cpu) {
    const specs = cpu.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('socket') || k.includes('suoritinkanta')) {
            const m = value.toString().match(/(AM4|AM5|LGA\s*1700|LGA\s*1851|LGA\s*1200)/i);
            if (m) return m[1].replace(/\s+/g, '');
        }
    }
    return null;
}

export function extractMotherboardSocket(mb) {
    const specs = mb.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('socket') || k.includes('prosessorikanta') || k.includes('suoritinkanta')) {
            const m = value.toString().match(/(AM4|AM5|LGA\s*1700|LGA\s*1851|LGA\s*1200)/i);
            if (m) return m[1].replace(/\s+/g, '');
        }
    }
    return null;
}

export function extractMotherboardMemoryType(mb) {
    const specs = mb.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('tuettu muistityyppi') || k.includes('memory type') || k.includes('supported memory')) {
            const m = value.toString().match(/(DDR[45])/i);
            if (m) return m[1];
        }
    }
    return null;
}

export function extractMemoryType(memory) {
    const specs = memory.specs || {};
    const name = memory.name.toLowerCase();
    for (const [, value] of Object.entries(specs)) {
        const v = value.toString().toLowerCase();
        if (v.includes('ddr5')) return 'DDR5';
        if (v.includes('ddr4')) return 'DDR4';
    }
    if (name.includes('ddr5')) return 'DDR5';
    if (name.includes('ddr4')) return 'DDR4';
    return null;
}

export function extractCPUMemoryType(cpu) {
    const specs = cpu.specs || {};
    const name = cpu.name.toLowerCase();

    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        const v = value.toString().toLowerCase();
        if (k.includes('muistityyppi') || k.includes('memory type') ||
            k.includes('supported memory') || k.includes('prosessorin tukemat muistityyppi')) {
            if (v.includes('ddr5')) return 'DDR5';
            if (v.includes('ddr4')) return 'DDR4';
        }
    }

    if (name.match(/i[3579]-1[234]/)) return null;
    if (name.includes('core ultra')) return 'DDR5';
    if (name.includes('ryzen') && name.match(/[79]\d{3}/)) return 'DDR5';
    if (name.includes('ryzen 5000') || name.includes('ryzen 3000') || name.match(/i[3579]-1[01]/)) return 'DDR4';
    return null;
}

export function extractGPULength(gpu) {
    const specs = gpu.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        if (key.toLowerCase().includes('pituus') || key.toLowerCase().includes('length')) {
            const m = value.toString().match(/(\d+)\s*mm/);
            if (m) return parseInt(m[1]);
        }
    }
    return null;
}

export function extractCaseGPUClearance(pcCase) {
    const specs = pcCase.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('gpu') && (k.includes('clearance') || k.includes('max'))) {
            const m = value.toString().match(/(\d+)\s*mm/);
            if (m) return parseInt(m[1]);
        }
    }
    return null;
}

export function extractCoolerCompatibility(cooler) {
    const specs = cooler.specs || {};
    const compat = [];
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('compatibility') || k.includes('yhteensopiv') || k.includes('socket')) {
            const sockets = value.toString().match(/(AM4|AM5|LGA\s*1700|LGA\s*1851|LGA\s*1200)/gi);
            if (sockets) compat.push(...sockets.map(s => s.replace(/\s+/g, '')));
        }
    }
    return compat.length > 0 ? compat : null;
}

export function extractFormFactor(component) {
    const specs = component.specs || {};
    const name = component.name.toLowerCase();

    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        const v = value.toString().toLowerCase();
        if (k.includes('form factor') || k.includes('muoto') || k.includes('koko')) {
            if (v.includes('e-atx') || v.includes('eatx')) return 'E-ATX';
            if (v.includes('micro-atx') || v.includes('matx') || v.includes('m-atx')) return 'Micro-ATX';
            if (v.includes('mini-itx') || v.includes('mitx')) return 'Mini-ITX';
            if (v.includes('atx')) return 'ATX';
        }
    }

    if (name.includes('mini-itx') || name.includes('mitx')) return 'Mini-ITX';
    if (name.includes('micro-atx') || name.includes('matx') || name.includes('m-atx')) return 'Micro-ATX';
    if (name.includes('e-atx') || name.includes('eatx')) return 'E-ATX';
    if (name.includes('atx')) return 'ATX';
    return null;
}

export function extractCaseFormFactors(pcCase) {
    const specs = pcCase.specs || {};
    const name = pcCase.name.toLowerCase();
    const supported = [];

    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        const v = value.toString().toLowerCase();
        if (k.includes('form factor') || k.includes('emolevy') || k.includes('tuetut')) {
            if (v.includes('e-atx') || v.includes('eatx')) supported.push('E-ATX');
            if (v.includes('atx') && !v.includes('micro') && !v.includes('mini')) supported.push('ATX');
            if (v.includes('micro-atx') || v.includes('matx') || v.includes('m-atx')) supported.push('Micro-ATX');
            if (v.includes('mini-itx') || v.includes('mitx')) supported.push('Mini-ITX');
        }
    }

    if (supported.length === 0) {
        if (name.includes('full tower')) return ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX'];
        if (name.includes('mid tower') || name.includes('midi tower')) return ['ATX', 'Micro-ATX', 'Mini-ITX'];
        if (name.includes('mini tower') || name.includes('micro')) return ['Micro-ATX', 'Mini-ITX'];
        if (name.includes('mini-itx') || name.includes('itx')) return ['Mini-ITX'];
    }

    return [...new Set(supported)];
}

export function extractCoolerHeight(cooler) {
    const specs = cooler.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('korkeus') || k.includes('height')) {
            const m = value.toString().match(/(\d+)\s*mm/);
            if (m) return parseInt(m[1]);
        }
    }
    return null;
}

export function extractCaseCoolerClearance(pcCase) {
    const specs = pcCase.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if ((k.includes('cooler') || k.includes('jäähdytin')) &&
            (k.includes('clearance') || k.includes('max') || k.includes('korkeus'))) {
            const m = value.toString().match(/(\d+)\s*mm/);
            if (m) return parseInt(m[1]);
        }
    }
    return null;
}

export function extractMemoryStickCount(memory) {
    const name = memory.name.toLowerCase();
    const specs = memory.specs || {};

    for (const [, value] of Object.entries(specs)) {
        const v = value.toString().toLowerCase();
        const stickMatch = v.match(/(\d+)\s*x\s*\d+\s*(gb|mb)/);
        if (stickMatch) return parseInt(stickMatch[1]);
        const countMatch = v.match(/(\d+)\s*(kpl|pieces|sticks)/);
        if (countMatch) return parseInt(countMatch[1]);
    }

    const nameMatch = name.match(/(\d+)\s*x\s*\d+\s*(gb|mb)/);
    if (nameMatch) return parseInt(nameMatch[1]);

    if (name.includes('kit') || name.includes('setti')) {
        if (name.includes('dual') || name.includes('2x')) return 2;
        if (name.includes('quad') || name.includes('4x')) return 4;
    }
    return 1;
}

export function extractMotherboardMemorySlots(mb) {
    const specs = mb.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        const v = value.toString().toLowerCase();
        if (k.includes('muistipaik') || k.includes('memory slot') || k.includes('dimm slot') || k.includes('ram slot')) {
            const m = v.match(/(\d+)/);
            if (m) return parseInt(m[1]);
        }
        if (k.includes('dimm') && !k.includes('so-dimm')) {
            const m = v.match(/(\d+)/);
            if (m) return parseInt(m[1]);
        }
    }
    const name = mb.name.toLowerCase();
    if (name.includes('mini-itx') || name.includes('mitx')) return 2;
    return 4;
}

export function extractMemorySpeed(memory) {
    const specs = memory.specs || {};
    const name = memory.name.toLowerCase();
    for (const [, value] of Object.entries(specs)) {
        const m = value.toString().match(/(\d+)\s*MHz/i);
        if (m) return parseInt(m[1]);
    }
    const nameMatch = name.match(/ddr[45]-?(\d+)/i);
    if (nameMatch) return parseInt(nameMatch[1]);
    return null;
}

export function extractPSUWattage(psu) {
    const specs = psu.specs || {};
    const name = psu.name.toLowerCase();
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('teho') || k.includes('power') || k.includes('watt')) {
            const m = value.toString().match(/(\d+)\s*W/i);
            if (m) return parseInt(m[1]);
        }
    }
    const nameMatch = name.match(/(\d+)\s*W/i);
    if (nameMatch) return parseInt(nameMatch[1]);
    return null;
}

export function extractComponentTDP(component) {
    const specs = component.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('tdp') || k.includes('tehokkuusluokka')) {
            const m = value.toString().match(/(\d+)\s*w/i);
            if (m) return parseInt(m[1]);
        }
    }
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if ((k.includes('teho') || k.includes('power')) && !k.includes('virtalähde') && !k.includes('supply')) {
            const m = value.toString().match(/(\d+)\s*w/i);
            if (m && parseInt(m[1]) < 500) return parseInt(m[1]);
        }
    }
    return null;
}

export function extractGPUPower(gpu) {
    const specs = gpu.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (k.includes('tdp') || k.includes('tgp') || k.includes('tbp') ||
            k.includes('power consumption') || k.includes('tehonkulutus')) {
            const m = value.toString().match(/(\d+)\s*w/i);
            if (m) return parseInt(m[1]);
        }
    }
    const name = gpu.name.toLowerCase();
    for (const [model, watts] of _hardware.gpuPower) {
        if (name.includes(model)) return watts;
    }
    return null;
}

export function getCPUTier(cpu) {
    const name = cpu.name.toLowerCase();
    for (const entry of _hardware.cpuTiers) {
        if (entry.pattern && new RegExp(entry.pattern).test(name)) return entry.tier;
        if (entry.keyword && name.includes(entry.keyword)) return entry.tier;
    }
    return null;
}

export function getGPUTier(gpu) {
    const name = gpu.name.toLowerCase();
    for (const [model, tier] of _hardware.gpuTiers) {
        if (name.includes(model)) return tier;
    }
    return null;
}

function isMemoryProduct(name, specs) {
    const hasDDR = name.includes('ddr4') || name.includes('ddr5');
    const hasMemoryTerms = name.includes('muisti') || name.includes('memory') || name.includes('ram') || name.includes('dimm');
    const isMemoryKit = name.includes('kit') && hasDDR;
    const hasMemorySpecs = Object.keys(specs).some(k =>
        k.toLowerCase().includes('muistityyppi') || k.toLowerCase().includes('memory type') ||
        (k.toLowerCase().includes('speed') && k.toLowerCase().includes('mhz'))
    );
    return hasDDR && (hasMemoryTerms || isMemoryKit || hasMemorySpecs);
}

function isPSUProduct(name, specs) {
    const hasPSUTerms = name.includes('virtalähdeyksikkö') || name.includes('virtalähde') ||
        name.includes('power supply') || name.includes('psu');
    const hasWattageWithContext = name.match(/\d+\s*w\b/) &&
        (name.includes('modular') || name.includes('atx') || name.includes('bronze') ||
         name.includes('gold') || name.includes('supply') || name.includes('unit'));
    const hasPSUSpecs = Object.keys(specs).some(k =>
        k.toLowerCase().includes('teho') || k.toLowerCase().includes('efficiency') || k.toLowerCase().includes('modular')
    );
    return hasPSUTerms || hasWattageWithContext || hasPSUSpecs;
}

function isStorageProduct(name, specs) {
    const hasStorageTerms = name.includes('ssd') || name.includes('hdd') || name.includes('nvme') ||
        name.includes('tallennustila') || name.includes('kiintolevy');
    const hasCapacityWithContext = name.match(/\d+\s*(gb|tb)/i) &&
        (name.includes('sata') || name.includes('m.2') || name.includes('drive') || name.includes('storage'));
    const hasStorageSpecs = Object.keys(specs).some(k =>
        k.toLowerCase().includes('kapasiteetti') || k.toLowerCase().includes('interface') ||
        k.toLowerCase().includes('read speed') || k.toLowerCase().includes('write speed')
    );
    return hasStorageTerms || hasCapacityWithContext || hasStorageSpecs;
}

function isCaseProduct(name) {
    const hasCaseTerms = name.includes('kotelo') || name.includes('chassis') ||
        (name.includes('case') && !name.includes('briefcase') && !name.includes('showcase'));
    const hasTowerTerms = name.includes('tower') && (name.includes('mid') || name.includes('full') || name.includes('mini'));
    const hasFormFactorTerms = name.includes('atx') && !name.includes('power');
    return hasCaseTerms || hasTowerTerms || hasFormFactorTerms;
}

export function determineActualCategory(productData) {
    const name = productData.name.toLowerCase();
    const specs = productData.specs || {};

    if (name.includes('jäähdytin') || name.includes('cooler') || name.includes('cooling') ||
        (name.includes('fan') && name.includes('cpu'))) return 'cooler';

    if (name.includes('processor') || (name.includes('prosessori') && !name.includes('prosessorin')) || name.includes('cpu') ||
        name.includes('ryzen') || name.includes('intel') || name.match(/i[3579]-\d+/)) return 'cpu';
    if (name.includes('geforce') || name.includes('radeon') || name.includes('rtx') ||
        name.includes('gtx') || name.includes('rx ') ||
        (name.includes('graphics') && !name.includes('integrated')) || name.includes('näytönohjain')) return 'gpu';
    if (name.includes('motherboard') || name.includes('emolevy') || name.includes('mainboard')) return 'motherboard';
    if (isMemoryProduct(name, specs)) return 'memory';
    if (isPSUProduct(name, specs)) return 'psu';
    if (isCaseProduct(name)) return 'case';
    if (isStorageProduct(name, specs)) return 'storage';
    return 'unknown';
}

function cleanSpecValue(value) {
    let cleaned = value.toString().trim();
    
    if (cleaned.length > 150) {
        cleaned = cleaned.substring(0, 150) + '...';
    }
    
    cleaned = cleaned.replace(/([a-zäöå])([A-ZÄÖÅ])/g, '$1 $2');
    cleaned = cleaned.replace(/(\d)([A-ZÄÖÅ][a-zäöå])/g, '$1 $2');
    
    return cleaned;
}

export function filterRelevantSpecs(specsArray) {
    const patterns = _specs.excludePatterns;
    return specsArray.filter(([key]) => {
        const k = key.toLowerCase();
        return !patterns.some(p => k.includes(p));
    }).map(([key, value]) => [key, cleanSpecValue(value)]);
}

export function getImportantSpecs(specs) {
    const filtered = filterRelevantSpecs(
        Object.entries(specs).filter(([key]) =>
            _specs.importantSpecKeys.some(imp => key.toLowerCase().includes(imp.toLowerCase()))
        )
    );
    return filtered.slice(0, 8);
}

export function getCategoryKeySpecs(productData) {
    const category = determineActualCategory(productData);
    const specs = productData.specs || {};
    const keys = (_specs.categoryKeySpecs || {})[category] || [];
    const results = [];

    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        if (keys.some(keyword => k.includes(keyword))) {
            results.push([key, cleanSpecValue(value)]);
        }
    }
    return results.slice(0, 3);
}

export function getCategoryDisplayName(category) {
    return (_specs.categoryDisplayNames || {})[category] || category;
}

export function getAllMemoryComponents(components, memoryCounter) {
    const memories = [];
    if (components.has('memory')) memories.push(components.get('memory'));
    for (let i = 1; i <= memoryCounter; i++) {
        if (components.has(`memory-${i}`)) memories.push(components.get(`memory-${i}`));
    }
    return memories;
}
