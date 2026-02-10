import * as E from './extractors.js';

export function checkCPUMotherboardCompatibility(components) {
    const cpu = components.get('cpu');
    const motherboard = components.get('motherboard');
    if (!cpu || !motherboard) return { compatible: true };

    const cpuSocket = E.extractCPUSocket(cpu);
    const moboSocket = E.extractMotherboardSocket(motherboard);

    if (cpuSocket && moboSocket) {
        if (E.normalizeSocket(cpuSocket) !== E.normalizeSocket(moboSocket)) {
            return {
                compatible: false,
                message: `Prosessori vaatii ${cpuSocket} kantaa, mutta emolevy tukee ${moboSocket} kantaa.`
            };
        }
    }
    return { compatible: true };
}

export function checkMemoryMotherboardCompatibility(components, memoryComponents) {
    const motherboard = components.get('motherboard');
    if (!motherboard || memoryComponents.length === 0) return { compatible: true };

    const moboMemType = E.extractMotherboardMemoryType(motherboard);
    for (const memory of memoryComponents) {
        const memType = E.extractMemoryType(memory);
        if (moboMemType && memType && moboMemType !== memType) {
            return {
                compatible: false,
                message: `Emolevy tukee ${moboMemType} muistia, mutta muisti on ${memType} tyyppiä.`
            };
        }
    }
    return { compatible: true };
}

export function checkMemoryCPUCompatibility(components, memoryComponents) {
    const cpu = components.get('cpu');
    if (!cpu || memoryComponents.length === 0) return { compatible: true };

    const cpuMemType = E.extractCPUMemoryType(cpu);
    for (const memory of memoryComponents) {
        const memType = E.extractMemoryType(memory);
        if (cpuMemType && memType && cpuMemType !== memType) {
            return {
                compatible: false,
                message: `Prosessori tukee ${cpuMemType} muistia, mutta muisti on ${memType} tyyppiä.`
            };
        }
    }
    return { compatible: true };
}

export function checkGPUCaseCompatibility(components) {
    const gpu = components.get('gpu');
    const pcCase = components.get('case');
    if (!gpu || !pcCase) return { compatible: true };

    const gpuLen = E.extractGPULength(gpu);
    const caseClear = E.extractCaseGPUClearance(pcCase);
    if (gpuLen && caseClear && gpuLen > caseClear) {
        return {
            compatible: false,
            message: `Näytönohjain on ${gpuLen}mm pitkä, mutta kotelo tukee max ${caseClear}mm kortteja.`
        };
    }
    return { compatible: true };
}

export function checkCoolerCPUCompatibility(components) {
    const cpu = components.get('cpu');
    const cooler = components.get('cooler');
    if (!cpu || !cooler) return { compatible: true };

    const cpuSocket = E.extractCPUSocket(cpu);
    const coolerCompat = E.extractCoolerCompatibility(cooler);
    if (cpuSocket && coolerCompat) {
        const norm = E.normalizeSocket(cpuSocket);
        const supported = coolerCompat.map(s => E.normalizeSocket(s));
        if (!supported.includes(norm)) {
            return {
                compatible: false,
                message: `Jäähdytin ei tue ${cpuSocket} kantaa. Tuetut kannat: ${coolerCompat.join(', ')}.`
            };
        }
    }
    return { compatible: true };
}

export function checkMemorySlotAvailability(components, memoryComponents) {
    const motherboard = components.get('motherboard');
    if (!motherboard || memoryComponents.length === 0) return { compatible: true };

    const totalSticks = memoryComponents.reduce((t, m) => t + E.extractMemoryStickCount(m), 0);
    const slots = E.extractMotherboardMemorySlots(motherboard);
    if (slots && totalSticks > slots) {
        return {
            compatible: false,
            message: `Muistikampoja on yhteensä ${totalSticks} kpl, mutta emolevyssä on vain ${slots} paikkaa.`
        };
    }
    return { compatible: true };
}

export function checkPSUWattageCompatibility(psu, systemPower) {
    if (!psu) return { compatible: true };
    const wattage = E.extractPSUWattage(psu);
    if (wattage && systemPower) {
        if (systemPower > wattage) {
            return {
                compatible: false,
                critical: true,
                message: `Järjestelmän arvioitu tehonkulutus (${systemPower}W) ylittää virtalähteen tehon (${wattage}W).`
            };
        }
        if (systemPower > wattage * 0.8) {
            return {
                compatible: false,
                critical: false,
                message: `Virtalähteen teho (${wattage}W) on lähellä järjestelmän arviota (${systemPower}W). Suositellaan vähintään 20% ylivaraa.`
            };
        }
    }
    return { compatible: true };
}

export function checkFormFactorCompatibility(components) {
    const motherboard = components.get('motherboard');
    const pcCase = components.get('case');
    if (!motherboard || !pcCase) return { compatible: true };

    const moboFF = E.extractFormFactor(motherboard);
    const caseFF = E.extractCaseFormFactors(pcCase);
    if (moboFF && caseFF.length > 0 && !caseFF.includes(moboFF)) {
        return {
            compatible: false,
            message: `Emolevy on ${moboFF}, mutta kotelo tukee: ${caseFF.join(', ')}.`
        };
    }
    return { compatible: true };
}

export function checkCoolerCaseCompatibility(components) {
    const cooler = components.get('cooler');
    const pcCase = components.get('case');
    if (!cooler || !pcCase) return { compatible: true };

    const height = E.extractCoolerHeight(cooler);
    const clearance = E.extractCaseCoolerClearance(pcCase);
    if (height && clearance && height > clearance) {
        return {
            compatible: false,
            message: `Jäähdytin on ${height}mm korkea, mutta kotelo tukee max ${clearance}mm jäähdytintä.`
        };
    }
    return { compatible: true };
}

export function checkMemoryCompatibility(cpu, memory) {
    const cpuMem = E.extractCPUMemoryType(cpu);
    const memType = E.extractMemoryType(memory);

    if (cpuMem && memType && cpuMem !== memType) {
        return {
            compatible: false,
            message: cpuMem === 'DDR4'
                ? 'Muisti on DDR5, mutta prosessori tukee vain DDR4. Valitse DDR4-muisti.'
                : 'Muisti on DDR4, mutta prosessori tukee vain DDR5. Valitse DDR5-muisti.'
        };
    }
    return { compatible: true };
}

export function analyzeBottleneck(cpu, gpu) {
    const cpuTier = E.getCPUTier(cpu);
    const gpuTier = E.getGPUTier(gpu);
    if (cpuTier === null || gpuTier === null) return { suggestion: null };

    const diff = cpuTier - gpuTier;
    if (diff >= 3) return { suggestion: 'Prosessori on selvästi tehokkaampi kuin näytönohjain. Tehokkaampi GPU parantaisi pelisuorituskykyä.' };
    if (diff <= -3) return { suggestion: 'Näytönohjain on selvästi tehokkaampi kuin prosessori. CPU voi pullonkaulata GPU:n suorituskykyä.' };
    return { suggestion: null };
}

export function checkIfCPUIncludesCooler(cpu) {
    const specs = cpu.specs || {};
    for (const [key, value] of Object.entries(specs)) {
        const k = key.toLowerCase();
        const v = value.toString().toLowerCase();
        if (k.includes('cooler') || k.includes('jäähdytin')) {
            if (v.includes('kyllä') || v.includes('yes') || v.includes('included') || v.includes('mukana')) {
                return true;
            }
        }
    }
    return false;
}

export function checkCPUMemorySupport(cpu) {
    const name = cpu.name.toLowerCase();
    return !!(name.match(/i[3579]-1[1-5]/) || name.includes('core ultra') ||
        name.includes('ryzen 5000') || name.includes('ryzen 7000') || name.includes('ryzen 9000'));
}

export function estimateSystemPower(components, memoryCounter, storageCounter) {
    let totalPower = 0;

    const cpu = components.get('cpu');
    if (cpu) totalPower += E.extractComponentTDP(cpu) || 65;

    const gpu = components.get('gpu');
    if (gpu) totalPower += E.extractGPUPower(gpu) || 150;

    const memoryComponents = E.getAllMemoryComponents(components, memoryCounter);
    const ramSticks = memoryComponents.reduce((t, m) => t + E.extractMemoryStickCount(m), 0);
    totalPower += (ramSticks || 0) * 5;

    let storageCount = components.has('storage') ? 1 : 0;
    for (let i = 1; i <= storageCounter; i++) {
        if (components.has(`storage-${i}`)) storageCount++;
    }
    totalPower += storageCount * 5;

    if (components.has('cooler')) totalPower += 10;
    if (components.size > 0) totalPower += 50;

    return totalPower;
}

export function validateComponentPlacement(slotType, productData) {
    const slotCategoryMap = {
        cpu: 'cpu', motherboard: 'motherboard', memory: 'memory',
        gpu: 'gpu', psu: 'psu', case: 'case', cooler: 'cooler', storage: 'storage'
    };
    const expected = slotCategoryMap[slotType] || 'unknown';
    const actual = E.determineActualCategory(productData);

    if ((slotType === 'storage' || slotType.startsWith('storage-')) && actual === 'storage') return { valid: true };
    if ((slotType === 'memory' || slotType.startsWith('memory-')) && actual === 'memory') return { valid: true };

    if (actual !== expected) {
        return { valid: false, message: getSlotMismatchMessage(slotType, expected, actual, productData.name) };
    }
    return { valid: true };
}

function getSlotMismatchMessage(slotType, expectedCategory, actualCategory, productName) {
    const allativeCases = {
        cpu: 'prosessorille', gpu: 'näytönohjaimelle', memory: 'muistille',
        storage: 'tallennustilalle', motherboard: 'emolevylle', psu: 'virtalähteelle',
        case: 'kotelolle', cooler: 'jäähdyttimelle'
    };
    const nominativeCases = {
        cpu: 'prosessori', gpu: 'näytönohjain', memory: 'muisti',
        storage: 'tallennustila', motherboard: 'emolevy', psu: 'virtalähde',
        case: 'kotelo', cooler: 'jäähdytin'
    };
    const expectedName = allativeCases[expectedCategory] || expectedCategory;
    const actualName = nominativeCases[actualCategory] || actualCategory;
    return `"${productName}" on ${actualName}, mutta tämä paikka on tarkoitettu ${expectedName}.`;
}

export function validateAllComponentPlacements(components) {
    const errors = [];
    components.forEach((component, type) => {
        const v = validateComponentPlacement(type, component);
        if (!v.valid) errors.push(`KRIITTINEN: ${v.message}`);
    });
    return errors;
}

export function generateSuggestions(components, memoryCounter, storageCounter) {
    const suggestions = [];
    const cpu = components.get('cpu');
    const gpu = components.get('gpu');
    const memory = components.get('memory');
    const motherboard = components.get('motherboard');
    const psu = components.get('psu');
    const memoryComponents = E.getAllMemoryComponents(components, memoryCounter);

    if (memory && motherboard) {
        const sticks = E.extractMemoryStickCount(memory);
        const slots = E.extractMotherboardMemorySlots(motherboard);
        if (sticks && slots && sticks > slots) {
            suggestions.push(`VAROITUS: Muistikampoja on ${sticks} kpl, mutta emolevyssä on vain ${slots} paikkaa.`);
        }
    }

    if (cpu && memory) {
        const mc = checkMemoryCompatibility(cpu, memory);
        if (!mc.compatible) suggestions.push(`KRIITTINEN: ${mc.message}`);
    }

    if (cpu && gpu) {
        const bn = analyzeBottleneck(cpu, gpu);
        if (bn.suggestion) suggestions.push(bn.suggestion);
    }

    if (cpu && memory) {
        const speed = E.extractMemorySpeed(memory);
        if (checkCPUMemorySupport(cpu) && (!speed || speed < 3200)) {
            suggestions.push('SUOSITUS: Harkitse nopeampaa muistia (DDR4-3200 tai nopeampi) parempaan suorituskykyyn.');
        }
    }

    if (psu && gpu) {
        const w = E.extractPSUWattage(psu);
        const sp = estimateSystemPower(components, memoryCounter, storageCounter);
        if (w && sp) {
            const eff = sp / w;
            if (eff > 0.9) suggestions.push('VAROITUS: Virtalähde on lähellä maksimitehoaan. Harkitse tehokkaampaa virtalähdettä.');
            else if (eff < 0.4) suggestions.push('HUOMIO: Virtalähde on ylimitoitettu. Pienempi virtalähde olisi energiatehokkaampi.');
        }
    }

    if (!components.has('cooler') && cpu && !checkIfCPUIncludesCooler(cpu)) {
        suggestions.push('TÄRKEÄÄ: Prosessori tarvitsee erillisen jäähdyttimen!');
    }
    if (!components.has('storage')) {
        suggestions.push('MUISTUTUS: Järjestelmä tarvitsee tallennustilan (SSD/HDD).');
    }

    return suggestions;
}

export function runAllCompatibilityChecks(components, memoryCounter, storageCounter) {
    const issues = [];
    const memoryComponents = E.getAllMemoryComponents(components, memoryCounter);

    issues.push(...validateAllComponentPlacements(components));

    const checks = [
        ['KRIITTINEN', checkCPUMotherboardCompatibility(components)],
        ['KRIITTINEN', checkMemoryMotherboardCompatibility(components, memoryComponents)],
        ['KRIITTINEN', checkMemoryCPUCompatibility(components, memoryComponents)],
        ['VAROITUS', checkGPUCaseCompatibility(components)],
        ['VAROITUS', checkCoolerCPUCompatibility(components)],
        ['KRIITTINEN', checkMemorySlotAvailability(components, memoryComponents)],
        ['KRIITTINEN', checkFormFactorCompatibility(components)],
        ['VAROITUS', checkCoolerCaseCompatibility(components)],
    ];

    for (const [severity, result] of checks) {
        if (!result.compatible) issues.push(`${severity}: ${result.message}`);
    }

    const systemPower = estimateSystemPower(components, memoryCounter, storageCounter);
    const psu = components.get('psu');
    const psuResult = checkPSUWattageCompatibility(psu, systemPower);
    if (!psuResult.compatible) {
        issues.push(`${psuResult.critical ? 'KRIITTINEN' : 'VAROITUS'}: ${psuResult.message}`);
    }

    return {
        issues,
        estimatedPower: systemPower,
        compatible: issues.filter(i => i.includes('KRIITTINEN')).length === 0
    };
}
