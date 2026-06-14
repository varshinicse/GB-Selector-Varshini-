/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MAGTORQ GB-Selector
 * Phase 1 Engineering Derivation Framework
 * Resolves missing parameter inputs from deterministic formulas.
 */

export interface DerivationRule {
  id: string;
  name: string;
  category: string;
  requiredInputs: string[];
  outputParameter: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  autoCalculate: boolean;
  formula: (inputs: Record<string, any>) => any;
  auditDescription: string;
  formulaString: string;
}

export interface DerivedTrace {
  ruleId: string;
  ruleName: string;
  inputsUsed: Record<string, any>;
  formulaUsed: string;
  outputProduced: string;
  value: any;
  timestamp: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SkipTrace {
  ruleId: string;
  ruleName: string;
  reason: string;
  valueIgnored: any;
}

export interface DerivationSessionReport {
  derivedParameters: Record<string, any>;
  traces: DerivedTrace[];
  skips: SkipTrace[];
}

// Helper: safe float parsing
function parseFloatsList(str: string): number[] {
  return str.split(/[\s,]+/).map(s => parseFloat(s)).filter(n => !isNaN(n));
}

// ─── Regex Parser from Raw Text ──────────────────────────────────────────────
export interface ExtractedParamMetadata {
  name: string;
  value: any;
  type: 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED' | 'ENGINE_RULE';
  source: string;
  formula: string;
  calculationSteps: string;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
  detectedText?: string;
}

export interface ParserResult {
  values: Record<string, any>;
  nodes: Record<string, ExtractedParamMetadata>;
}

export function parseInputsWithMetadata(text: string): ParserResult {
  const values: Record<string, any> = {};
  const nodes: Record<string, ExtractedParamMetadata> = {};

  const matchValue = (
    regexes: RegExp[],
    modifier?: (v: number, match: RegExpMatchArray) => number,
    fieldName: string = 'unknown',
    displayName: string = 'Parameter'
  ) => {
    for (const regex of regexes) {
      const match = text.match(regex);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) {
          const finalVal = modifier ? modifier(val, match) : val;
          
          // Debug Logging showing: Raw Text -> Extracted Entity -> Normalized Parameter -> Final Internal Field
          console.log(`[EXTRACTION DEBUG]
  Raw Text Segment: "${match[0].trim()}"
  Extracted Entity: "${match[1]}" (Unit: "${match[2] || 'none'}")
  Normalized Parameter: "${val}"
  Final Internal Field: "${fieldName}: ${finalVal}"`);

          values[fieldName] = finalVal;
          nodes[fieldName] = {
            name: displayName,
            value: finalVal,
            type: 'EXTRACTED',
            source: 'Customer RFQ Description',
            formula: 'N/A',
            calculationSteps: `Extracted from text: "${match[0].trim()}"`,
            confidence: 'High',
            reasoning: `Extracted value ${finalVal} directly from text matching pattern.`,
            detectedText: match[0].trim()
          };
          return finalVal;
        }
      }
    }
    return null;
  };

  // Convert mm to meters if the value is large (e.g. > 10)
  const diameterModifier = (v: number, match: RegExpMatchArray) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'mm') return v / 1000;
    if (unit === 'm') return v;
    return v > 10 ? v / 1000 : v;
  };

  // 0. Parameter Alias Mapping Layer
  // Input RPM
  matchValue([
    /(?:Motor\s+RPM|Motor\s+Speed|Drive\s+Motor\s+RPM|Drive\s+Speed|Input\s+Speed|Gearbox\s+Input\s+Speed|Motor\s+Nameplate\s+Speed|Rated\s+Motor\s+Speed|Motor\s+Output\s+Speed|Prime\s+Mover\s+Speed|Engine\s+RPM|Pump\s+RPM|Drive\s+Motor|\bINP\s+SPD\b|\bINP\.\s*SPD\b|\bINPUT\s+SPD\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:(?:\d+(?:\.\d+)?)\s*(?:kW|HP|kW\s+motor|HP\s+motor|Hz|pole|poles|V|volts?)[\s,;-]*)*?(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(?:RPM|r\/min|speed)?/i,
    /(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(?:RPM|r\/min|speed)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Motor\s+RPM|Motor\s+Speed|Drive\s+Motor\s+RPM|Drive\s+Speed|Input\s+Speed|Gearbox\s+Input\s+Speed|Motor\s+Nameplate\s+Speed|Rated\s+Motor\s+Speed|Motor\s+Output\s+Speed|Prime\s+Mover\s+Speed|Engine\s+RPM|Pump\s+RPM|\bINP\s+SPD\b|\bINP\.\s*SPD\b|\bINPUT\s+SPD\b)/i
  ], undefined, 'inputRPM', 'Input Speed');

  // Output RPM
  matchValue([
    /(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|Required\s+Output\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(?:RPM|r\/min|speed)?/i,
    /(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(?:RPM|r\/min|speed)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b)/i
  ], undefined, 'outputRPM', 'Output Speed');

  // Ratio
  matchValue([
    /(?:\bRatio\b|\bReduction\s+Ratio\b|\bGear\s+Ratio\b|\bOverall\s+Ratio\b|\bReduction\b|\bReduction\s+Number\b|\bTransmission\s+Ratio\b|\bReduction\s+Factor\b|\bReduction\s+Rate\b|\bi\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)\s*(?::\s*1)?/i,
    /(\d+(?:\.\d+)?)\s*(?::\s*1)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:\bRatio\b|\bReduction\s+Ratio\b|\bGear\s+Ratio\b|\bOverall\s+Ratio\b|\bReduction\b|\bReduction\s+Number\b|\bTransmission\s+Ratio\b|\bReduction\s+Factor\b|\bReduction\s+Rate\b|\bi\b)/i,
    /\b(\d+(?:\.\d+)?)\s*:\s*1\b/i
  ], undefined, 'totalRatio', 'Total Ratio');

  // Power
  matchValue([
    /(?:Power|Motor\s+Power|Drive\s+Power|Motor\s+Rating|Motor\s+Capacity|Installed\s+Power|Connected\s+Load|Motor|\bPWR\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:RPM|r\/min|speed|poles?|hz|v|volts?))\s*(kW|HP|Kilowatt|Horsepower|h\.p\.)?/i,
    /(\d+(?:\.\d+)?)(?![.\d])\s*(?:kW|HP|Kilowatt|Horsepower|h\.p\.)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Power|Motor\s+Power|Drive\s+Power|Motor\s+Rating|Motor\s+Capacity|Installed\s+Power|Connected\s+Load|Motor|\bPWR\b)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'hp' || unit === 'horsepower' || unit === 'h.p.') {
      return v * 0.7457;
    }
    return v;
  }, 'powerKW', 'Power');

  // Torque
  matchValue([
    /(?:\bTorque\b|Output\s+Torque|Input\s+Torque|Rated\s+Torque|Running\s+Torque|Load\s+Torque|Holding\s+Torque|Design\s+Torque|Peak\s+Torque|Breakout\s+Torque)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)\s*(?:N[·\-\.]?m|Newton[ \-]?meters?|kgf?[·\-\.]?m|kg[·\-\.]?m|lb[·\-\.]?ft|ft[·\-\.]?lbs?|lb[·\-\.]?in|in[·\-\.]?lbs?)?/i,
    /(\d+(?:\.\d+)?)\s*(?:N[·\-\.]?m|Newton[ \-]?meters?|kgf?[·\-\.]?m|kg[·\-\.]?m|lb[·\-\.]?ft|ft[·\-\.]?lbs?|lb[·\-\.]?in|in[·\-\.]?lbs?)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:\bTorque\b|Output\s+Torque|Input\s+Torque|Rated\s+Torque|Running\s+Torque|Load\s+Torque|Holding\s+Torque|Design\s+Torque|Peak\s+Torque|Breakout\s+Torque)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('kgf') || unit.includes('kg')) return v * 9.80665;
    if (unit.includes('ft') || unit.includes('lb')) return v * 1.35581794833;
    if (unit.includes('in')) return v * 0.112984829;
    return v;
  }, 'outputTorqueNm', 'Output Torque');

  // Service Factor
  matchValue([
    /(?:service\s+factor|SF|factor)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)/i
  ], undefined, 'serviceFactor', 'Service Factor');

  // 1. Conveyor & General Speed Inputs
  matchValue([
    /(?:belt\s+speed|beltSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min)\s+(?:belt)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) return v / 60;
    return v;
  }, 'beltSpeed_m_s', 'Belt Speed');

  matchValue([
    /(?:pulley\s+diameter|pulleyDia|pulleyDiameter|pulley\s+dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:pulley\s+diameter|pulley)/i
  ], diameterModifier, 'pulleyDiameter_m', 'Pulley Diameter');

  // 2. Chain Conveyor Speed Inputs
  matchValue([
    /(?:chain\s+speed|chainSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min)\s+(?:chain)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) return v / 60;
    return v;
  }, 'chainSpeed_m_s', 'Chain Speed');

  matchValue([
    /(?:sprocket\s+PCD|sprocketPcd|sprocketDiameter|sprocket\s+dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:sprocket)/i
  ], diameterModifier, 'sprocketPCD_m', 'Sprocket PCD');

  // 3. Bucket Elevator Speed Inputs
  matchValue([
    /(?:bucket\s+speed|bucketSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min)\s+(?:bucket)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) return v / 60;
    return v;
  }, 'bucketSpeed_m_s', 'Bucket Speed');

  matchValue([
    /(?:head\s+pulley\s+(?:diameter|dia)|headPulleyDia|headPulleyDiameter)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:head\s+pulley)/i
  ], diameterModifier, 'headPulleyDiameter_m', 'Head Pulley Diameter');

  // 4. Hoist & Winch Inputs
  matchValue([
    /(?:hoist\s+speed|lifting\s+speed|liftingSpeed|hoistSpeed|lift\s+speed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min|meters\/min|meters\/minute)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min|meters\/min|meters\/minute)\s+(?:hoist|lift|lifting)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.includes('min')) {
      return v / 60;
    }
    return v;
  }, 'hoistSpeed_m_s', 'Lifting Speed');

  matchValue([
    /(?:drum\s+diameter|drumDiameter|drum\s+dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i,
    /(\d+\.?\d*)\s*(mm|m)\s+(?:drum)/i
  ], diameterModifier, 'drumDiameter_m', 'Drum Diameter');

  const reevingVal = matchValue([
    /(?:reeving\s+falls|reeving|rope\s+falls|falls)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+)/i
  ], undefined, 'reevingFalls', 'Reeving Falls');
  if (reevingVal === null) {
    values.reevingFalls = 1;
    nodes.reevingFalls = {
      name: 'Reeving Falls',
      value: 1,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed default single fall reeving',
      confidence: 'Medium',
      reasoning: 'Default single fall (1) reeving assumed for hoisting drivetrain.'
    };
  }

  // Loads / Forces
  matchValue([
    /(?:belt\s+pull|effective\s+(?:pull\s+)?tension|pull\s+tension|beltPull|F_eff|pull)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    return v;
  }, 'beltPull_N', 'Belt Pull Force');

  matchValue([
    /(?:hoist\s+load|lifting\s+load|load\s+to\s+be\s+lifted|hoistLoad|F_load|load|weight)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N|kg|t|tons|ton|tonnes)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    if (unit === 'ton' || unit === 'tonne' || unit === 't' || unit === 'tons' || unit === 'tonnes') return v * 9806.65;
    if (unit === 'kg') return v * 9.80665;
    return v;
  }, 'hoistLoad_N', 'Hoist Load Force');

  matchValue([
    /(?:line\s+pull|linePull|tension|F_line)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    return v;
  }, 'linePull_N', 'Line Pull Force');

  // 5. Fan & Pump Inputs
  matchValue([
    /(?:airflow|air\s+flow|flow\s+rate|flow)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m3\/s|m³\/s|cfm)?/i
  ], undefined, 'airflow_m3_s', 'Airflow Rate');

  matchValue([
    /(?:static\s+pressure|staticPressure|pressure|ΔP_static)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(Pa|pa)?/i
  ], undefined, 'staticPressure_Pa', 'Static Pressure');

  const fanEff = matchValue([
    /(?:fan\s+efficiency|fanEfficiency|efficiency|η_fan)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'fanEfficiency', 'Fan Efficiency');
  if (fanEff === null) {
    values.fanEfficiency = 0.70;
    nodes.fanEfficiency = {
      name: 'Fan Efficiency',
      value: 0.70,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed standard fan efficiency',
      confidence: 'Medium',
      reasoning: 'Standard default 70% efficiency assumed for airflow calculations.'
    };
  }

  matchValue([
    /(?:flow\s+rate|liquid\s+flow|flow|Q)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m3\/s|m³\/s)?/i
  ], undefined, 'flowRate_m3_s', 'Pump Flow Rate');

  matchValue([
    /(?:pump\s+head|pumpHead|head|H)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m|meters)?/i
  ], undefined, 'pumpHead_m', 'Pump Head');

  const pumpEff = matchValue([
    /(?:pump\s+efficiency|pumpEfficiency|η_pump)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'pumpEfficiency', 'Pump Efficiency');
  if (pumpEff === null) {
    values.pumpEfficiency = 0.75;
    nodes.pumpEfficiency = {
      name: 'Pump Efficiency',
      value: 0.75,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed standard pump efficiency',
      confidence: 'Medium',
      reasoning: 'Standard default 75% efficiency assumed for hydraulic calculations.'
    };
  }

  const density = matchValue([
    /(?:liquid\s+density|density|ρ)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kg\/m3|kg\/m³)?/i
  ], undefined, 'liquidDensity_kg_m3', 'Liquid Density');
  if (density === null) {
    values.liquidDensity_kg_m3 = 1000;
    nodes.liquidDensity_kg_m3 = {
      name: 'Liquid Density',
      value: 1000,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed water density 1000 kg/m³',
      confidence: 'Medium',
      reasoning: 'Standard default 1000 kg/m³ water density assumed for fluid pumping.'
    };
  }

  // 6. Acceleration & RMS
  matchValue([
    /(?:system\s+inertia|inertia|J_total|J)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kg\s*m2|kg\s*m²|kgm2)?/i
  ], undefined, 'systemInertia_kg_m2', 'System Inertia');

  matchValue([
    /(?:delta\s+speed|speed\s+change|ΔN)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:RPM|rpm)?/i
  ], undefined, 'deltaSpeed_RPM', 'Delta Speed');

  matchValue([
    /(?:capacity|flow\s+rate|throughput|mass\s+flow)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:TPH|t\/h|tonnes\/hour)?/i
  ], undefined, 'capacity_tph', 'Capacity');

  matchValue([
    /(?:lift\s+height|lift|vertical\s+lift|elevation|height)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m|meters)?/i
  ], undefined, 'liftHeight_m', 'Lift Height');

  matchValue([
    /(?:acceleration\s+time|accel\s+time|t_accel|time)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:s|sec|seconds)?/i
  ], undefined, 'accelTime_s', 'Acceleration Time');

  // Load arrays for RMS
  const torquesMatch = text.match(/(?:loadTorques|torques)\s*(?:is|of|was)?\s*[:\s=]*\s*\[([\d\s,.]+)\]/i);
  if (torquesMatch) {
    values.loadTorques_Nm = parseFloatsList(torquesMatch[1]);
    nodes.loadTorques_Nm = {
      name: 'Load Torques Profile',
      value: values.loadTorques_Nm,
      type: 'EXTRACTED',
      source: 'Customer RFQ Description',
      formula: 'N/A',
      calculationSteps: `Extracted torques profile: [${values.loadTorques_Nm.join(', ')}]`,
      confidence: 'High',
      reasoning: 'Extracted variable load step profile for RMS torque check.'
    };
  }
  const durationsMatch = text.match(/(?:loadDurations|durations)\s*(?:is|of|was)?\s*[:\s=]*\s*\[([\d\s,.]+)\]/i);
  if (durationsMatch) {
    values.loadDurations_s = parseFloatsList(durationsMatch[1]);
    nodes.loadDurations_s = {
      name: 'Load Durations Profile',
      value: values.loadDurations_s,
      type: 'EXTRACTED',
      source: 'Customer RFQ Description',
      formula: 'N/A',
      calculationSteps: `Extracted durations profile: [${values.loadDurations_s.join(', ')}]`,
      confidence: 'High',
      reasoning: 'Extracted step duration profile for RMS torque check.'
    };
  }

  // 7. Generic Motion & Thermal / Life
  matchValue([
    /(?:linear\s+speed|linearSpeed|velocity|travelSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m\/s)?/i
  ], undefined, 'linearSpeed_m_s', 'Linear Speed');

  matchValue([
    /(?:effective\s+diameter|effectiveDiameter|D_effective)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i
  ], diameterModifier, 'effectiveDiameter_m', 'Effective Diameter');

  matchValue([
    /(?:design\s+power|designPower|P_design)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kW|kw)?/i
  ], undefined, 'designPower_kW', 'Design Power');

  matchValue([
    /(?:on\s+time|onTime|t_on)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:min|minutes)?/i
  ], undefined, 'onTime_min', 'On-Time');

  matchValue([
    /(?:off\s+time|offTime|t_off)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:min|minutes)?/i
  ], undefined, 'offTime_min', 'Off-Time');

  matchValue([
    /(?:service\s+years|serviceYears|lifespan|years|Y)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'serviceYears', 'Service Years');

  matchValue([
    /(?:hours\s+per\s+day|hours\/day|operatingHours|H_per_day)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'hoursPerDay', 'Hours per Day');

  const avail = matchValue([
    /(?:availability\s+factor|availability|U_availability)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'availabilityFactor', 'Availability Factor');
  if (avail === null) {
    values.availabilityFactor = 1.0;
    nodes.availabilityFactor = {
      name: 'Availability Factor',
      value: 1.0,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed standard availability coefficient',
      confidence: 'Medium',
      reasoning: 'Standard 100% duty availability assumed for service life calculations.'
    };
  }

  matchValue([
    /(?:input\s+power|inputPower|power|P_in)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:kW|kw)?/i
  ], undefined, 'inputPower_kW', 'Input Power');

  const eff = matchValue([
    /(?:efficiency|gearboxEfficiency|η)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'efficiency', 'Gearbox Efficiency');
  if (eff === null) {
    values.efficiency = 0.97;
    nodes.efficiency = {
      name: 'Gearbox Efficiency',
      value: 0.97,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed 97% stage efficiency',
      confidence: 'Medium',
      reasoning: 'Standard default 97% planetary stage efficiency assumed.'
    };
  }

  // 8. Gear & Transmission Details for Gear Geometry Derivations
  matchValue([
    /(?:pinion\s*teeth|pinion\s*has|pinion\s*count)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+)/i
  ], undefined, 'pinionTeeth', 'Pinion Teeth Count');

  matchValue([
    /(?:gear\s*teeth|gear\s*has|gear\s*count)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+)/i
  ], undefined, 'gearTeeth', 'Gear Teeth Count');

  matchValue([
    /(?:driver\s*pulley|driver\s*pulley\s*diameter|driver\s*pulley\s*dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i
  ], diameterModifier, 'driverPulleyDiameter_m', 'Driver Pulley Diameter');

  matchValue([
    /(?:driven\s*pulley|driven\s*pulley\s*diameter|driven\s*pulley\s*dia)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(mm|m)?/i
  ], diameterModifier, 'drivenPulleyDiameter_m', 'Driven Pulley Diameter');

  matchValue([
    /(?:driver\s*sprocket|driver\s*sprocket\s*teeth|driver\s*sprocket\s*count)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+)/i
  ], undefined, 'driverSprocketTeeth', 'Driver Sprocket Teeth Count');

  matchValue([
    /(?:driven\s*sprocket|driven\s*sprocket\s*teeth|driven\s*sprocket\s*count)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+)/i
  ], undefined, 'drivenSprocketTeeth', 'Driven Sprocket Teeth Count');

  matchValue([
    /(?:module|gear\s*module)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:mm)?/i
  ], undefined, 'gearModule_mm', 'Gear Module');

  matchValue([
    /(?:face\s*width|gear\s*face\s*width|face\s*width\s*of)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:mm)?/i
  ], undefined, 'gearFaceWidth_mm', 'Gear Face Width');

  matchValue([
    /(?:yield\s*strength|material\s*strength|strength)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:MPa|mpa)?/i
  ], undefined, 'gearMaterialYield_MPa', 'Material Yield Strength');

  matchValue([
    /(?:tangential\s+load|tangentialLoad|F_t)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    return v;
  }, 'tangentialLoad_N', 'Tangential Load');

  matchValue([
    /(?:force|\bF\b)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    return v;
  }, 'force_N', 'Force');

  matchValue([
    /(?:load|weight|mass)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kg|g)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'g') return v / 1000;
    return v;
  }, 'load_kg', 'Load in kg');

  // Extract application type for Service Factor
  const appMatch = text.match(/(?:belt\s+)?conveyor/i) ? 'conveyor' :
                   text.match(/fan/i) ? 'fan' :
                   text.match(/crusher/i) ? 'crusher' :
                   text.match(/mining/i) ? 'mining' : null;
  if (appMatch) {
    values.applicationType = appMatch;
  }

  // Check duty cycle (24x7 or Continuous)
  const is24x7 = text.match(/24\s*(?:x|\*)\s*7/i) || text.match(/24\s*hours/i) || text.match(/continuous/i);
  if (is24x7) {
    values.is24x7Duty = true;
  }

  // Check shock load
  const isShock = text.match(/shock\s*load/i) || text.match(/heavy\s*shock/i) || text.match(/heavy\s*load/i) || text.match(/load\s*[:=\s]*\s*heavy/i);
  if (isShock) {
    values.isShockLoad = true;
  }

  // Generic RPM matching for any remaining undefined RPMs
  const rpmRegex = /\b(\d+(?:\.\d+)?)\s*(?:RPM|rpm|r\/min)\b/gi;
  let match;
  const foundRpms: number[] = [];
  while ((match = rpmRegex.exec(text)) !== null) {
    const val = parseFloat(match[1]);
    if (!foundRpms.includes(val)) {
      foundRpms.push(val);
    }
  }

  if (foundRpms.length > 0) {
    // Sort in descending order: highest RPM first (likely input), lowest last (likely output)
    foundRpms.sort((a, b) => b - a);

    const assignRPM = (paramKey: 'inputRPM' | 'outputRPM', name: string, val: number) => {
      values[paramKey] = val;
      nodes[paramKey] = {
        name,
        value: val,
        type: 'EXTRACTED',
        source: 'Customer RFQ Description',
        formula: 'N/A',
        calculationSteps: `Extracted generic speed: ${val} RPM`,
        confidence: 'High',
        reasoning: 'Extracted RPM from generic text matching pattern as fallback.'
      };
    };

    if (!values.inputRPM && !values.outputRPM) {
      if (foundRpms.length >= 2) {
        assignRPM('inputRPM', 'Input Speed', foundRpms[0]);
        assignRPM('outputRPM', 'Output Speed', foundRpms[foundRpms.length - 1]);
      } else {
        const val = foundRpms[0];
        if (val >= 500) {
          assignRPM('inputRPM', 'Input Speed', val);
        } else {
          assignRPM('outputRPM', 'Output Speed', val);
        }
      }
    } else if (!values.inputRPM) {
      const candidate = foundRpms.find(r => r !== values.outputRPM);
      if (candidate !== undefined) {
        assignRPM('inputRPM', 'Input Speed', candidate);
      }
    } else if (!values.outputRPM) {
      const candidate = foundRpms.find(r => r !== values.inputRPM);
      if (candidate !== undefined) {
        assignRPM('outputRPM', 'Output Speed', candidate);
      }
    }
  }

  return { values, nodes };
}

export function parseInputsFromText(text: string): Record<string, any> {
  return parseInputsWithMetadata(text).values;
}

// ─── Rule Implementations ───────────────────────────────────────────────────
export const derivationRules: DerivationRule[] = [
  {
    id: 'DR-001',
    name: 'Conveyor Belt Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['beltSpeed_m_s', 'pulleyDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = (v_belt × 60) / (π × D_pulley)',
    auditDescription: 'Derives the target output speed of a conveyor pulley from the required linear belt speed and pulley diameter.',
    formula: (inputs) => {
      const { beltSpeed_m_s, pulleyDiameter_m } = inputs;
      if (pulleyDiameter_m <= 0) return null;
      return (beltSpeed_m_s * 60) / (Math.PI * pulleyDiameter_m);
    }
  },
  {
    id: 'DR-002',
    name: 'Chain Conveyor Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['chainSpeed_m_s', 'sprocketPCD_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = (v_chain × 60) / (π × D_sprocket_PCD)',
    auditDescription: 'Derives the target output speed of a chain conveyor from the chain speed and sprocket pitch circle diameter.',
    formula: (inputs) => {
      const { chainSpeed_m_s, sprocketPCD_m } = inputs;
      if (sprocketPCD_m <= 0) return null;
      return (chainSpeed_m_s * 60) / (Math.PI * sprocketPCD_m);
    }
  },
  {
    id: 'DR-003',
    name: 'Bucket Elevator Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['bucketSpeed_m_s', 'headPulleyDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = (v_bucket × 60) / (π × D_head_pulley)',
    auditDescription: 'Derives target head shaft speed of a bucket elevator from bucket speed and head pulley diameter.',
    formula: (inputs) => {
      const { bucketSpeed_m_s, headPulleyDiameter_m } = inputs;
      if (headPulleyDiameter_m <= 0) return null;
      return (bucketSpeed_m_s * 60) / (Math.PI * headPulleyDiameter_m);
    }
  },
  {
    id: 'DR-004',
    name: 'Hoist Speed to Drum RPM',
    category: 'Speed',
    requiredInputs: ['hoistSpeed_m_s', 'drumDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_drum = (v_lift × 60) / (π × D_drum)',
    auditDescription: 'Derives hoist drum speed from required lifting velocity and drum diameter.',
    formula: (inputs) => {
      const { hoistSpeed_m_s, drumDiameter_m } = inputs;
      if (drumDiameter_m <= 0) return null;
      return (hoistSpeed_m_s * 60) / (Math.PI * drumDiameter_m);
    }
  },
  {
    id: 'DR-005',
    name: 'Belt Pull to Torque',
    category: 'Torque',
    requiredInputs: ['beltPull_N', 'pulleyDiameter_m'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Tout = (F_eff × D_pulley) / 2',
    auditDescription: 'Calculates the output drive torque of a belt conveyor pulley from effective belt pull tension and pulley diameter.',
    formula: (inputs) => {
      const { beltPull_N, pulleyDiameter_m } = inputs;
      return (beltPull_N * pulleyDiameter_m) / 2;
    }
  },
  {
    id: 'DR-006',
    name: 'Hoist Torque',
    category: 'Torque',
    requiredInputs: ['hoistLoad_N', 'drumDiameter_m', 'reevingFalls'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_drum = (F_load × D_drum) / (2 × n_falls)',
    auditDescription: 'Calculates hoist drum shaft torque from lifting load, drum diameter, and reeving configuration.',
    formula: (inputs) => {
      const { hoistLoad_N, drumDiameter_m, reevingFalls } = inputs;
      if (reevingFalls <= 0) return null;
      return (hoistLoad_N * drumDiameter_m) / (2 * reevingFalls);
    }
  },
  {
    id: 'DR-007',
    name: 'Winch Torque',
    category: 'Torque',
    requiredInputs: ['linePull_N', 'drumDiameter_m'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_drum = F_line × D_drum / 2',
    auditDescription: 'Calculates winch drum output torque from line tension pull and drum diameter.',
    formula: (inputs) => {
      const { linePull_N, drumDiameter_m } = inputs;
      return (linePull_N * drumDiameter_m) / 2;
    }
  },
  {
    id: 'DR-008',
    name: 'Fan Power',
    category: 'Power',
    requiredInputs: ['airflow_m3_s', 'staticPressure_Pa', 'fanEfficiency'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_shaft = (Q_flow × ΔP_static) / (1000 × η_fan)',
    auditDescription: 'Determines fan shaft power requirements from design static pressure rise, flow rate, and fan efficiency.',
    formula: (inputs) => {
      const { airflow_m3_s, staticPressure_Pa, fanEfficiency } = inputs;
      if (fanEfficiency <= 0) return null;
      return (airflow_m3_s * staticPressure_Pa) / (1000 * fanEfficiency);
    }
  },
  {
    id: 'DR-009',
    name: 'Pump Power',
    category: 'Power',
    requiredInputs: ['flowRate_m3_s', 'pumpHead_m', 'pumpEfficiency', 'liquidDensity_kg_m3'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_shaft = (ρ × g × Q × H) / (1000 × η_pump)',
    auditDescription: 'Derives pump shaft power demand from liquid density, flow rate, head capacity, and pump efficiency.',
    formula: (inputs) => {
      const { flowRate_m3_s, pumpHead_m, pumpEfficiency, liquidDensity_kg_m3 } = inputs;
      if (pumpEfficiency <= 0) return null;
      return (liquidDensity_kg_m3 * 9.80665 * flowRate_m3_s * pumpHead_m) / (1000 * pumpEfficiency);
    }
  },
  {
    id: 'DR-010',
    name: 'Acceleration Torque',
    category: 'Torque',
    requiredInputs: ['systemInertia_kg_m2', 'deltaSpeed_RPM', 'accelTime_s'],
    outputParameter: 'accelerationTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_accel = J_total × (ΔN × 2π / 60) / t_accel',
    auditDescription: 'Calculates torque needed to accelerate inertia loads to operational speed within target time window.',
    formula: (inputs) => {
      const { systemInertia_kg_m2, deltaSpeed_RPM, accelTime_s } = inputs;
      if (accelTime_s <= 0) return null;
      const alpha = (deltaSpeed_RPM * 2 * Math.PI) / (60 * accelTime_s);
      return systemInertia_kg_m2 * alpha;
    }
  },
  {
    id: 'DR-011',
    name: 'RMS Torque from Load Steps',
    category: 'Torque',
    requiredInputs: ['loadTorques_Nm', 'loadDurations_s'],
    outputParameter: 'rmsTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_rms = √ ( ∑(T_i² × t_i) / ∑(t_i) )',
    auditDescription: 'Calculates equivalent root-mean-square torque across variable load/time step profile blocks.',
    formula: (inputs) => {
      const { loadTorques_Nm, loadDurations_s } = inputs;
      if (!Array.isArray(loadTorques_Nm) || !Array.isArray(loadDurations_s) || loadTorques_Nm.length === 0 || loadTorques_Nm.length !== loadDurations_s.length) return null;
      let weightedSum = 0;
      let totalTime = 0;
      for (let i = 0; i < loadTorques_Nm.length; i++) {
        weightedSum += loadTorques_Nm[i] * loadTorques_Nm[i] * loadDurations_s[i];
        totalTime += loadDurations_s[i];
      }
      if (totalTime <= 0) return null;
      return Math.sqrt(weightedSum / totalTime);
    }
  },
  {
    id: 'DR-012',
    name: 'Linear Speed to RPM',
    category: 'Speed',
    requiredInputs: ['linearSpeed_m_s', 'effectiveDiameter_m'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N = v_linear × 60 / (π × D_effective)',
    auditDescription: 'Converts target linear travel velocity to equivalent shaft rotational speed based on drum/pinion diameter.',
    formula: (inputs) => {
      const { linearSpeed_m_s, effectiveDiameter_m } = inputs;
      if (effectiveDiameter_m <= 0) return null;
      return (linearSpeed_m_s * 60) / (Math.PI * effectiveDiameter_m);
    }
  },
  {
    id: 'DR-013',
    name: 'Thermal Duty Cycle Power',
    category: 'Power',
    requiredInputs: ['designPower_kW', 'onTime_min', 'offTime_min'],
    outputParameter: 'effectiveThermalPowerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_thermal_eff = P_design × √ ( t_on / (t_on + t_off) )',
    auditDescription: 'Calculates equivalent continuous thermal power dissipation factor for periodic on/off cycles.',
    formula: (inputs) => {
      const { designPower_kW, onTime_min, offTime_min } = inputs;
      const totalTime = onTime_min + offTime_min;
      if (totalTime <= 0) return null;
      return designPower_kW * Math.sqrt(onTime_min / totalTime);
    }
  },
  {
    id: 'DR-014',
    name: 'Service Life Hours',
    category: 'Duty',
    requiredInputs: ['serviceYears', 'hoursPerDay', 'availabilityFactor'],
    outputParameter: 'requiredLifeHours',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'L_hours = Y_years × 365 × H_per_day × U_availability',
    auditDescription: 'Computes total target operating hours over the specified gearbox service lifespan.',
    formula: (inputs) => {
      const { serviceYears, hoursPerDay, availabilityFactor } = inputs;
      return serviceYears * 365 * hoursPerDay * availabilityFactor;
    }
  },
  {
    id: 'DR-015',
    name: 'Efficiency Corrected Torque',
    category: 'Torque',
    requiredInputs: ['powerKW', 'efficiency', 'outputRPM'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Tout = (Pin × η_gearbox × 9549.3) / N_out',
    auditDescription: 'Calculates mechanical output shaft torque adjusted for losses across planetary stages.',
    formula: (inputs) => {
      const { powerKW, efficiency, outputRPM } = inputs;
      if (outputRPM <= 0) return null;
      return (powerKW * efficiency * 9549.3) / outputRPM;
    }
  },
  {
    id: 'DR-016',
    name: 'Input Speed and Ratio to Output RPM',
    category: 'Speed',
    requiredInputs: ['inputRPM', 'totalRatio'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = N_in / Ratio',
    auditDescription: 'Calculates target output speed from input speed and ratio.',
    formula: (inputs) => {
      const { inputRPM, totalRatio } = inputs;
      if (totalRatio <= 0) return null;
      return inputRPM / totalRatio;
    }
  },
  {
    id: 'DR-017',
    name: 'Input Speed and Output Speed to Ratio',
    category: 'Speed',
    requiredInputs: ['inputRPM', 'outputRPM'],
    outputParameter: 'totalRatio',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Ratio = N_in / N_out',
    auditDescription: 'Calculates overall gear ratio from input speed and output speed.',
    formula: (inputs) => {
      const { inputRPM, outputRPM } = inputs;
      if (outputRPM <= 0) return null;
      return inputRPM / outputRPM;
    }
  },
  {
    id: 'DR-018',
    name: 'Output Speed and Ratio to Input RPM',
    category: 'Speed',
    requiredInputs: ['outputRPM', 'totalRatio'],
    outputParameter: 'inputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_in = N_out × Ratio',
    auditDescription: 'Calculates required input motor speed from output speed and ratio.',
    formula: (inputs) => {
      const { outputRPM, totalRatio } = inputs;
      return outputRPM * totalRatio;
    }
  },
  {
    id: 'DR-019',
    name: 'Motor Pole Count and Frequency to Input Speed',
    category: 'Speed',
    requiredInputs: ['motorPoles', 'frequencyHz'],
    outputParameter: 'inputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_in = (120 × f / Poles) × (1 - Slip)',
    auditDescription: 'Calculates actual input motor speed from pole count and frequency, accounting for average motor slip.',
    formula: (inputs) => {
      const { motorPoles, frequencyHz } = inputs;
      if (motorPoles <= 0) return null;
      const sync = (120 * frequencyHz) / motorPoles;
      return sync * (1 - 0.033);
    }
  },
  {
    id: 'DR-020',
    name: 'Output Torque and Output Speed to Power',
    category: 'Power',
    requiredInputs: ['outputTorqueNm', 'outputRPM', 'efficiency'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_in = (Tout × Nout) / (9549.3 × η)',
    auditDescription: 'Derives required input shaft power from output load torque, speed, and efficiency.',
    formula: (inputs) => {
      const { outputTorqueNm, outputRPM, efficiency } = inputs;
      if (efficiency <= 0 || outputRPM <= 0) return null;
      return (outputTorqueNm * outputRPM) / (9549.3 * efficiency);
    }
  },
  {
    id: 'DR-021',
    name: 'Motor HP to kW',
    category: 'Power',
    requiredInputs: ['motorHP'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_kw = HP × 0.7457',
    auditDescription: 'Converts motor HP rating to kW.',
    formula: (inputs) => {
      return inputs.motorHP * 0.7457;
    }
  },
  {
    id: 'DR-022',
    name: 'Screw Jack Linear Speed to Output RPM',
    category: 'Speed',
    requiredInputs: ['linearSpeed_mm_min', 'screwPitch_mm'],
    outputParameter: 'outputRPM',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'N_out = v_linear / p_screw',
    auditDescription: 'Derives output speed for screw jack from linear travel velocity and screw pitch.',
    formula: (inputs) => {
      const { linearSpeed_mm_min, screwPitch_mm } = inputs;
      if (screwPitch_mm <= 0) return null;
      return linearSpeed_mm_min / screwPitch_mm;
    }
  },
  {
    id: 'DR-023',
    name: 'Stage Selection Rule',
    category: 'Stages',
    requiredInputs: ['totalRatio'],
    outputParameter: 'stages',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Stages = f(Ratio)',
    auditDescription: 'Selects the number of planetary reduction stages based on overall target gear ratio limits.',
    formula: (inputs) => {
      const r = inputs.totalRatio;
      if (r <= 10) return 1;
      if (r <= 80) return 2;
      if (r <= 500) return 3;
      return 4;
    }
  },
  {
    id: 'DR-024',
    name: 'Belt Power',
    category: 'Power',
    requiredInputs: ['beltPull_N', 'beltSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_eff × v_belt / 1000',
    auditDescription: 'Calculates design power from belt pull tension and linear travel speed.',
    formula: (inputs) => {
      return (inputs.beltPull_N * inputs.beltSpeed_m_s) / 1000;
    }
  },
  {
    id: 'DR-025',
    name: 'Hoist Load Power',
    category: 'Power',
    requiredInputs: ['hoistLoad_N', 'hoistSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_load × v_hoist / 1000',
    auditDescription: 'Calculates design power from hoist load force and linear hoist speed.',
    formula: (inputs) => {
      return (inputs.hoistLoad_N * inputs.hoistSpeed_m_s) / 1000;
    }
  },
  {
    id: 'DR-026',
    name: 'Line Pull Power',
    category: 'Power',
    requiredInputs: ['linePull_N', 'hoistSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_line × v_hoist / 1000',
    auditDescription: 'Calculates design power from winch line pull and hoist/winch speed.',
    formula: (inputs) => {
      return (inputs.linePull_N * inputs.hoistSpeed_m_s) / 1000;
    }
  },
  {
    id: 'DR-POWER-001',
    name: 'Torque and Speed to Power (Standard)',
    category: 'Power',
    requiredInputs: ['outputTorqueNm', 'outputRPM'],
    outputParameter: 'powerKW',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'P = T × N / 9550',
    auditDescription: 'Derives power from torque and rotational speed directly using the standard constant 9550.',
    formula: (inputs) => {
      const { outputTorqueNm, outputRPM } = inputs;
      if (outputRPM <= 0) return null;
      return (outputTorqueNm * outputRPM) / 9550;
    }
  },
  {
    id: 'DR-POWER-002',
    name: 'Force and Velocity to Power',
    category: 'Power',
    requiredInputs: ['force_N', 'linearSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'P = Force × Velocity / 1000',
    auditDescription: 'Derives power in kW from generic force in Newtons and linear velocity in m/s.',
    formula: (inputs) => {
      return (inputs.force_N * inputs.linearSpeed_m_s) / 1000;
    }
  },
  {
    id: 'DR-POWER-003',
    name: 'Load and Speed to Power',
    category: 'Power',
    requiredInputs: ['load_kg', 'linearSpeed_m_s'],
    outputParameter: 'powerKW',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'P = Load_kg × 9.80665 × Speed_m_s / 1000',
    auditDescription: 'Derives power in kW from load in kg and velocity in m/s.',
    formula: (inputs) => {
      return (inputs.load_kg * 9.80665 * inputs.linearSpeed_m_s) / 1000;
    }
  },
  {
    id: 'DR-POWER-004',
    name: 'Estimate Power from Gear Capacity',
    category: 'Power',
    requiredInputs: ['torqueCapacity', 'outputRPM'],
    outputParameter: 'powerKW',
    confidence: 'LOW',
    autoCalculate: true,
    formulaString: 'P = torqueCapacity × N_out / 9550',
    auditDescription: 'Estimates power capability from gear bending torque capacity and speed.',
    formula: (inputs) => {
      const { torqueCapacity, outputRPM } = inputs;
      if (outputRPM <= 0) return null;
      return (torqueCapacity * outputRPM) / 9550;
    }
  },
  {
    id: 'DR-TORQUE-001',
    name: 'Power and Speed to Torque (Standard)',
    category: 'Torque',
    requiredInputs: ['powerKW', 'outputRPM'],
    outputParameter: 'outputTorqueNm',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'T = 9550 × P / N',
    auditDescription: 'Calculates standard output torque from power and rotational speed using standard constant 9550.',
    formula: (inputs) => {
      const { powerKW, outputRPM } = inputs;
      if (outputRPM <= 0) return null;
      return (9550 * powerKW) / outputRPM;
    }
  },
  {
    id: 'DR-TORQUE-002',
    name: 'Tangential Load and Radius to Torque',
    category: 'Torque',
    requiredInputs: ['tangentialLoad_N', 'radius_m'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T = F_t × r',
    auditDescription: 'Calculates output torque from tangential load and radius.',
    formula: (inputs) => {
      return inputs.tangentialLoad_N * inputs.radius_m;
    }
  },
  {
    id: 'DR-TORQUE-003',
    name: 'Lewis Tangential Load Capacity',
    category: 'Torque',
    requiredInputs: ['gearMaterialYield_MPa', 'gearFaceWidth_mm', 'gearModule_mm', 'pinionTeeth'],
    outputParameter: 'tangentialLoad_N',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'W_t = (σ_yield / 3) × b × (π × (0.154 - 0.912 / z)) × m',
    auditDescription: 'Calculates the allowable tangential load using the Lewis bending strength formula.',
    formula: (inputs) => {
      const { gearMaterialYield_MPa, gearFaceWidth_mm, gearModule_mm, pinionTeeth } = inputs;
      if (pinionTeeth <= 0) return null;
      const sigma_a = gearMaterialYield_MPa / 3;
      const Y = Math.PI * (0.154 - 0.912 / pinionTeeth);
      return sigma_a * gearFaceWidth_mm * Y * gearModule_mm;
    }
  },
  {
    id: 'DR-TORQUE-004',
    name: 'Torque Capacity from Gear Geometry',
    category: 'Torque',
    requiredInputs: ['tangentialLoad_N', 'radius_m'],
    outputParameter: 'torqueCapacity',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'T_cap = W_t × r',
    auditDescription: 'Derives the torque capacity from tangential load limit and pinion radius.',
    formula: (inputs) => {
      return inputs.tangentialLoad_N * inputs.radius_m;
    }
  },
  {
    id: 'DR-TORQUE-005',
    name: 'Torque Capacity to Output Torque',
    category: 'Torque',
    requiredInputs: ['torqueCapacity'],
    outputParameter: 'outputTorqueNm',
    confidence: 'LOW',
    autoCalculate: true,
    formulaString: 'T_out = T_cap',
    auditDescription: 'Uses the estimated torque capacity from gear geometry as output torque when other details are missing.',
    formula: (inputs) => {
      return inputs.torqueCapacity;
    }
  },
  {
    id: 'DR-GEOMETRY-001',
    name: 'Pinion Pitch Radius from Module and Teeth',
    category: 'Geometry',
    requiredInputs: ['gearModule_mm', 'pinionTeeth'],
    outputParameter: 'radius_m',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'r = (m × z) / 2000',
    auditDescription: 'Calculates pinion pitch radius in meters from module and tooth count.',
    formula: (inputs) => {
      return (inputs.gearModule_mm * inputs.pinionTeeth) / 2000;
    }
  },

  {
    id: 'DR-RATIO-001',
    name: 'Gear Teeth Ratio',
    category: 'Ratio',
    requiredInputs: ['gearTeeth', 'pinionTeeth'],
    outputParameter: 'totalRatio',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Ratio = z_gear / z_pinion',
    auditDescription: 'Calculates gear ratio from the tooth counts of gear and pinion.',
    formula: (inputs) => {
      const { gearTeeth, pinionTeeth } = inputs;
      if (pinionTeeth <= 0) return null;
      return gearTeeth / pinionTeeth;
    }
  },
  {
    id: 'DR-RATIO-002',
    name: 'Pulley Diameter Ratio',
    category: 'Ratio',
    requiredInputs: ['drivenPulleyDiameter_m', 'driverPulleyDiameter_m'],
    outputParameter: 'totalRatio',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Ratio = D_driven / D_driver',
    auditDescription: 'Calculates pulley ratio from driven and driver pulley diameters.',
    formula: (inputs) => {
      const { drivenPulleyDiameter_m, driverPulleyDiameter_m } = inputs;
      if (driverPulleyDiameter_m <= 0) return null;
      return drivenPulleyDiameter_m / driverPulleyDiameter_m;
    }
  },
  {
    id: 'DR-RATIO-003',
    name: 'Sprocket Teeth Ratio',
    category: 'Ratio',
    requiredInputs: ['drivenSprocketTeeth', 'driverSprocketTeeth'],
    outputParameter: 'totalRatio',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Ratio = z_driven / z_driver',
    auditDescription: 'Calculates sprocket ratio from driven and driver sprocket teeth counts.',
    formula: (inputs) => {
      const { drivenSprocketTeeth, driverSprocketTeeth } = inputs;
      if (driverSprocketTeeth <= 0) return null;
      return drivenSprocketTeeth / driverSprocketTeeth;
    }
  },
  {
    id: 'DR-SF-001',
    name: 'Application-Based Service Factor',
    category: 'Service Factor',
    requiredInputs: ['applicationType'],
    outputParameter: 'serviceFactor',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'SF = Base_SF (Fan: 1.2, Conveyor: 1.5, Crusher: 2.0, Mining: 2.5) + (24x7: +0.2) + (Shock: +0.3)',
    auditDescription: 'Derives service factor based on application type and operating conditions.',
    formula: (inputs) => {
      const { applicationType, is24x7Duty, isShockLoad } = inputs;
      let sf = 1.0;
      if (applicationType === 'fan') sf = 1.2;
      else if (applicationType === 'conveyor') sf = 1.5;
      else if (applicationType === 'crusher') sf = 2.0;
      else if (applicationType === 'mining') sf = 2.5;

      if (is24x7Duty) sf += 0.2;
      if (isShockLoad) sf += 0.3;
      
      return sf;
    }
  },
  {
    id: 'DR-RPM-002',
    name: 'Power and Torque to Speed (Standard)',
    category: 'Speed',
    requiredInputs: ['powerKW', 'outputTorqueNm'],
    outputParameter: 'outputRPM',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'N = 9550 × P / T',
    auditDescription: 'Calculates speed in RPM from power in kW and torque in Nm using the standard constant 9550.',
    formula: (inputs) => {
      const { powerKW, outputTorqueNm } = inputs;
      if (outputTorqueNm <= 0) return null;
      return (9550 * powerKW) / outputTorqueNm;
    }
  },
  {
    id: 'DR-TORQUE-006',
    name: 'Design Torque Calculation',
    category: 'Torque',
    requiredInputs: ['outputTorqueNm', 'serviceFactor'],
    outputParameter: 'designTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'DesignTorque = Torque × SF',
    auditDescription: 'Calculates the design torque by multiplying the nominal output torque by the service factor.',
    formula: (inputs) => {
      const { outputTorqueNm, serviceFactor } = inputs;
      return outputTorqueNm * serviceFactor;
    }
  }
];

// ─── backward-chaining resolution solver ────────────────────────────────────
export class MissingParameterResolutionEngine {
  /**
   * Resolves missing parameters from a set of known inputs using backward-chaining.
   * Priority: USER INPUT / HANDBOOK CALCULATION > ENGINE_RULE
   * Values already provided will NOT be overwritten.
   */
  static resolve(
    knownParameters: Record<string, any>,
    userProvidedKeys: Set<string> = new Set()
  ): DerivationSessionReport & { missingInputsForTargets?: Record<string, string[][]> } {
    const derivedParameters = { ...knownParameters };
    const traces: DerivedTrace[] = [];
    const skips: SkipTrace[] = [];
    const missingInputsForTargets: Record<string, string[][]> = {};

    const resolveParameter = (
      param: string,
      visited: Set<string>
    ): { value: any } => {
      // 2. Cycle detection
      if (visited.has(param)) {
        return { value: null };
      }

      const nextVisited = new Set(visited);
      nextVisited.add(param);

      // 3. Find all rules capable of producing this parameter
      const rules = derivationRules.filter((r) => r.outputParameter === param).sort((a, b) => {
        const confMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return confMap[b.confidence] - confMap[a.confidence];
      });


      // 4. If parameter is already resolved, return it (but record skips if inputs are available)
      const isAlreadyResolved =
        derivedParameters[param] !== undefined &&
        derivedParameters[param] !== null &&
        (typeof derivedParameters[param] !== 'number' || !isNaN(derivedParameters[param]));

      if (isAlreadyResolved) {
        for (const rule of rules) {
          const inputsMap: Record<string, any> = {};
          let allInputsAvailable = true;
          for (const input of rule.requiredInputs) {
            const val = derivedParameters[input];
            if (val !== null && val !== undefined && (typeof val !== 'number' || !isNaN(val))) {
              inputsMap[input] = val;
            } else {
              allInputsAvailable = false;
              break;
            }
          }
          if (allInputsAvailable) {
            if (!skips.some((s) => s.ruleId === rule.id)) {
              const formulaInputs = {
                ...inputsMap,
                is24x7Duty: derivedParameters.is24x7Duty,
                isShockLoad: derivedParameters.isShockLoad
              };
              skips.push({
                ruleId: rule.id,
                ruleName: rule.name,
                reason: 'Output parameter is already defined by user input or handbook calculations.',
                valueIgnored: rule.formula(formulaInputs)
              });
            }
          }
        }
        return { value: derivedParameters[param] };
      }

      if (rules.length === 0) {
        return { value: null };
      }

      for (const rule of rules) {
        const inputsMap: Record<string, any> = {};
        let missingForThisRule = false;

        for (const input of rule.requiredInputs) {
          const res = resolveParameter(input, nextVisited);
          if (res.value !== null && res.value !== undefined) {
            inputsMap[input] = res.value;
          } else {
            missingForThisRule = true;
            break;
          }
        }

        if (!missingForThisRule) {
          // Check if output is already resolved by User Input or Handbook Calculation
          const isUserOrHandbook =
            userProvidedKeys.has(rule.outputParameter) ||
            (knownParameters[rule.outputParameter] !== undefined &&
              knownParameters[rule.outputParameter] !== null);

          if (isUserOrHandbook) {
            if (!skips.some((s) => s.ruleId === rule.id)) {
              const formulaInputs = {
                ...inputsMap,
                is24x7Duty: derivedParameters.is24x7Duty,
                isShockLoad: derivedParameters.isShockLoad
              };
              skips.push({
                ruleId: rule.id,
                ruleName: rule.name,
                reason: 'Output parameter is already defined by user input or handbook calculations.',
                valueIgnored: rule.formula(formulaInputs)
              });
            }
            return { value: knownParameters[rule.outputParameter] };
          }

          // Evaluate formula
          try {
            const formulaInputs = {
              ...inputsMap,
              is24x7Duty: derivedParameters.is24x7Duty,
              isShockLoad: derivedParameters.isShockLoad
            };
            const result = rule.formula(formulaInputs);
            if (result !== null && result !== undefined && !isNaN(result)) {
              derivedParameters[param] = result;
              
              if (!traces.some((t) => t.ruleId === rule.id)) {
                traces.push({
                  ruleId: rule.id,
                  ruleName: rule.name,
                  inputsUsed: formulaInputs,
                  formulaUsed: rule.formulaString,
                  outputProduced: `${rule.outputParameter} = ${typeof result === 'number' ? result.toFixed(3) : result}`,
                  value: result,
                  timestamp: new Date().toISOString(),
                  confidence: rule.confidence
                });
              }
              return { value: result };
            }
          } catch (err) {
            console.error(`Error resolving rule ${rule.id}:`, err);
          }
        }
      }

      return { value: null };
    };

    const getMissingPaths = (param: string, visited: Set<string>): string[][] => {
      if (visited.has(param) || visited.size > 5) {
        return [];
      }
      const nextVisited = new Set(visited);
      nextVisited.add(param);

      const isAlreadyResolved =
        derivedParameters[param] !== undefined &&
        derivedParameters[param] !== null &&
        (typeof derivedParameters[param] !== 'number' || !isNaN(derivedParameters[param]));

      if (isAlreadyResolved) {
        return [];
      }

      const allPaths: string[][] = [[param]];

      const rules = derivationRules.filter((r) => r.outputParameter === param);
      for (const rule of rules) {
        if (allPaths.length > 15) {
          break;
        }
        let ruleInputPaths: string[][] = [[]];
        for (const input of rule.requiredInputs) {
          const inputPaths = getMissingPaths(input, nextVisited);
          if (inputPaths.length === 0) {
            continue;
          }
          const nextRuleInputPaths: string[][] = [];
          for (const p1 of ruleInputPaths) {
            for (const p2 of inputPaths) {
              if (p1.length + p2.length <= 10) {
                nextRuleInputPaths.push([...p1, ...p2]);
              }
            }
          }
          ruleInputPaths = nextRuleInputPaths;
        }
        for (const path of ruleInputPaths) {
          const sortedUnique = Array.from(new Set(path)).sort();
          if (!allPaths.some(p => p.length === sortedUnique.length && p.every((val, idx) => val === sortedUnique[idx]))) {
            allPaths.push(sortedUnique);
          }
          if (allPaths.length > 15) {
            break;
          }
        }
      }

      return allPaths;
    };


    // Try resolving all possible target output parameters
    const allTargets = Array.from(new Set(derivationRules.map((r) => r.outputParameter)));
    for (const target of allTargets) {
      resolveParameter(target, new Set());
    }

    // Now calculate the missing paths for each target
    for (const target of allTargets) {
      const paths = getMissingPaths(target, new Set());
      if (paths.length > 0 && paths[0].length > 0) {
        missingInputsForTargets[target] = paths;
      }
    }

    return { derivedParameters, traces, skips, missingInputsForTargets };
  }
}

