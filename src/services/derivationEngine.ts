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
  type?: 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED' | 'ENGINE_RULE' | 'ASSUMED_VALUE';
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
  type: 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED' | 'ENGINE_RULE' | 'ASSUMED_VALUE';
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
  // Simplify mathematical derivations like "1450 / 123 = 11.79" or "(5000 * 20) / 9550 = 10.47" to just the result
  text = text.replace(/(?:\(?\d+(?:\.\d+)?\)?\s*[\/*+x×()\s-]\s*)+\d+(?:\.\d+)?\s*=\s*(\d+(?:\.\d+)?)/g, '$1');
  // Strip thousands separator commas from numbers
  text = text.replace(/(\d),(\d{3}(?!\d))/g, '$1$2');
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
          let rawVal = val;
          const numIndex = match.index! + match[0].indexOf(match[1]) + match[1].length;
          const trailing = text.slice(numIndex, numIndex + 10).toLowerCase().trim();
          if (trailing.startsWith('rps') && (fieldName === 'inputRadS' || fieldName === 'outputRadS')) {
            rawVal = rawVal * 60;
          }
          const finalVal = modifier ? modifier(rawVal, match) : rawVal;
          
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
  // Input RPM -> inputRadS
  matchValue([
    /(?:Motor\s+RPM|Motor\s+Speed|Drive\s+Motor\s+RPM|Drive\s+Speed|Input\s+Speed|Gearbox\s+Input\s+Speed|Motor\s+Nameplate\s+Speed|Rated\s+Motor\s+Speed|Motor\s+Output\s+Speed|Prime\s+Mover\s+Speed|Engine\s+RPM|Pump\s+RPM|Drive\s+Motor|\bINP\s+SPD\b|\bINP\.\s*SPD\b|\bINPUT\s+SPD\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:approximately|approx\.?|about|around|~)?\s*(?:(?:\d+(?:\.\d+)?)\s*(?:kW|HP|kW\s+motor|HP\s+motor|Hz|pole|poles|V|volts?)[\s,;-]*)*?(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?/i,
    /(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Motor\s+RPM|Motor\s+Speed|Drive\s+Motor\s+RPM|Drive\s+Speed|Input\s+Speed|Gearbox\s+Input\s+Speed|Motor\s+Nameplate\s+Speed|Rated\s+Motor\s+Speed|Motor\s+Output\s+Speed|Prime\s+Mover\s+Speed|Engine\s+RPM|Pump\s+RPM|\bINP\s+SPD\b|\bINP\.\s*SPD\b|\bINPUT\s+SPD\b)/i
  ], (v) => v * (2 * Math.PI) / 60, 'inputRadS', 'Input Speed');

  // Output RPM -> outputRadS
  matchValue([
    /(?<!input\s+|motor\s+|inlet\s+|drive\s+)(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|Required\s+Output\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b|\bRPM\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:approximately|approx\.?|about|around|~)?\s*(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?/i,
    /(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?<!input\s+|motor\s+|inlet\s+|drive\s+)(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b)/i
  ], (v) => v * (2 * Math.PI) / 60, 'outputRadS', 'Output Speed');

  // Output Speed Max Constraint
  matchValue([
    /(?<!input\s+|motor\s+|inlet\s+|drive\s+)(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|Required\s+Output\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b|\bRPM\b)(?:\s+(?:Limit|Range|Req|Requirement|Threshold))?\s*(?:<=|less\s+than|max|maximum|should\s+be\s+less\s+than|should\s+be\s*<=)\s*(\d+(?:\.\d+)?)/i,
    /(?:max|maximum)\s+(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|Required\s+Output\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b|\bRPM\b)(?:\s+(?:Limit|Range|Req|Requirement|Threshold))?\s*(?:of|is|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)/i
  ], undefined, 'outputSpeedMax', 'Max Output Speed Constraint');

  // Output Speed Min Constraint
  matchValue([
    /(?<!input\s+|motor\s+|inlet\s+|drive\s+)(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|Required\s+Output\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b|\bRPM\b)(?:\s+(?:Limit|Range|Req|Requirement|Threshold))?\s*(?:>=|greater\s+than|min|minimum|should\s+be\s+greater\s+than|should\s+be\s*>=)\s*(\d+(?:\.\d+)?)/i,
    /(?:min|minimum)\s+(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|Required\s+Output\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b|\bRPM\b)(?:\s+(?:Limit|Range|Req|Requirement|Threshold))?\s*(?:of|is|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)/i
  ], undefined, 'outputSpeedMin', 'Min Output Speed Constraint');

  // Ratio
  matchValue([
    /(?:\bRatio\b|\bReduction\s+Ratio\b|\bGear\s+Ratio\b|\bOverall\s+Ratio\b|\bReduction\b|\bReduction\s+Number\b|\bTransmission\s+Ratio\b|\bReduction\s+Factor\b|\bReduction\s+Rate\b|\bi\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:approximately|approx\.?|about|around|~)?\s*(\d+(?:\.\d+)?)\s*(?::\s*1)?/i,
    /(\d+(?:\.\d+)?)\s*(?::\s*1)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:\bRatio\b|\bReduction\s+Ratio\b|\bGear\s+Ratio\b|\bOverall\s+Ratio\b|\bReduction\b|\bReduction\s+Number\b|\bTransmission\s+Ratio\b|\bReduction\s+Factor\b|\bReduction\s+Rate\b|\bi\b)/i,
    /\b(\d+(?:\.\d+)?)\s*:\s*1\b/i
  ], undefined, 'totalRatio', 'Total Ratio');

  // Power -> powerW
  matchValue([
    /(?:Power|Motor\s+Power|Drive\s+Power|Motor\s+Rating|Motor\s+Capacity|Installed\s+Power|Connected\s+Load|Motor|\bPWR\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:approximately|approx\.?|about|around|~)?\s*(\d+(?:\.\d+)?)(?![.\d])(?!\s*(?:RPM|r\/min|speed|poles?|hz|v|volts?))\s*(kW|HP|Kilowatt|Horsepower|h\.p\.|W|Watt|Watts)?/i,
    /(\d+(?:\.\d+)?)(?![.\d])\s*(kW|HP|Kilowatt|Horsepower|h\.p\.|W|Watt|Watts)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Power|Motor\s+Power|Drive\s+Power|Motor\s+Rating|Motor\s+Capacity|Installed\s+Power|Connected\s+Load|Motor|\bPWR\b)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'hp' || unit === 'horsepower' || unit === 'h.p.') {
      return v * 745.7;
    }
    if (unit === 'w' || unit === 'watt' || unit === 'watts') {
      return v;
    }
    return v * 1000; // Default to kW -> W
  }, 'powerW', 'Power');

  // Motor HP -> motorHP
  matchValue([
    /(?:Motor\s+)?HP\s*[:=\s]*\s*(\d+(?:\.\d+)?)\s*(?:HP)?/i
  ], undefined, 'motorHP', 'Motor HP');

  // Torque
  matchValue([
    /(?<!input\s+|motor\s+|inlet\s+|drive\s+)(?:\bTorque\b|Output\s+Torque|Rated\s+Torque|Running\s+Torque|Load\s+Torque|Holding\s+Torque|Design\s+Torque|Peak\s+Torque|Breakout\s+Torque)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:approximately|approx\.?|about|around|~)?\s*(\d+(?:\.\d+)?)\s*(k?N[·\-\.\s]?m|Newton[ \-]?meters?|kilonewton[ \-]?meters?|kgf?[·\-\.\s]?m|lbs?[·\-\.\s]?(?:ft|in)|(?:ft|in)[·\-\.\s]?lbs?)?/i,
    /(\d+(?:\.\d+)?)\s*(k?N[·\-\.\s]?m|Newton[ \-]?meters?|kilonewton[ \-]?meters?|kgf?[·\-\.\s]?m|lbs?[·\-\.\s]?(?:ft|in)|(?:ft|in)[·\-\.\s]?lbs?)\s*(?:is|of|was)?\s*[:=\s]*\s*(?<!input\s+|motor\s+|inlet\s+|drive\s+)(?:\bTorque\b|Output\s+Torque|Rated\s+Torque|Running\s+Torque|Load\s+Torque|Holding\s+Torque|Design\s+Torque|Peak\s+Torque|Breakout\s+Torque)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.startsWith('kn') || unit.includes('kilonewton')) return v * 1000;
    if (unit.includes('kgf') || unit.includes('kg')) return v * 9.81;
    if (unit.includes('ft') || unit.includes('lb')) {
      if (unit.includes('in')) return v * 0.112984829;
      return v * 1.35581794833;
    }
    return v;
  }, 'outputTorqueNm', 'Output Torque');

  // Service Factor
  matchValue([
    /(?:service\s+factor|SF|factor)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:approximately|approx\.?|about|around|~)?\s*(\d+(?:\.\d+)?)/i
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
    /(?:hoist\s+speed|lifting\s+speed|liftingSpeed|hoistSpeed|lift\s+speed|travel\s+speed|travelSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m\/s|m\/min|meters\/min|meters\/minute)?/i,
    /(\d+\.?\d*)\s*(m\/s|m\/min|meters\/min|meters\/minute)\s+(?:hoist|lift|lifting|travel)/i
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
    if (unit === 'ton' || unit === 'tonne' || unit === 't' || unit === 'tons' || unit === 'tonnes') return v * 9810;
    if (unit === 'kg') return v * 9.81;
    return v;
  }, 'hoistLoad_N', 'Hoist Load Force');

  matchValue([
    /(?:line\s+pull|linePull|tension|F_line)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'kn') return v * 1000;
    return v;
  }, 'linePull_N', 'Line Pull Force');

  // Input Torque
  matchValue([
    /(?:input\s+torque|motor\s+torque|drive\s+torque)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)\s*(k?N[·\-\.\s]?m|Newton[ \-]?meters?|kilonewton[ \-]?meters?|kgf?[·\-\.\s]?m|lbs?[·\-\.\s]?(?:ft|in)|(?:ft|in)[·\-\.\s]?lbs?)?/i,
    /(\d+(?:\.\d+)?)\s*(k?N[·\-\.\s]?m|Newton[ \-]?meters?|kilonewton[ \-]?meters?|kgf?[·\-\.\s]?m|lbs?[·\-\.\s]?(?:ft|in)|(?:ft|in)[·\-\.\s]?lbs?)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:input\s+torque|motor\s+torque|drive\s+torque)/i
  ], (v, match) => {
    const unit = (match[2] || '').toLowerCase();
    if (unit.startsWith('kn') || unit.includes('kilonewton')) return v * 1000;
    if (unit.includes('kgf') || unit.includes('kg')) return v * 9.81;
    if (unit.includes('ft') || unit.includes('lb')) {
      if (unit.includes('in')) return v * 0.112984829;
      return v * 1.35581794833;
    }
    return v;
  }, 'inputTorqueNm', 'Input Torque');

  // Hydraulic parameters
  matchValue([
    /(?<!static\s+|inlet\s+|outlet\s+|pump\s+)(?:\bpressure\b|hydraulic\s+pressure)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:bar)\b/i,
    /(?:hydraulic\s+)?pressure\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:bar)\b/i
  ], (v) => v * 100000, 'hydraulicPressure_Pa', 'Hydraulic Pressure');

  matchValue([
    /(?<!air|pump|liquid|water|oil\s+)(?:\bflow\b|hydraulic\s+flow)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:L\/min|lpm)\b/i,
    /(?:hydraulic\s+)?flow\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:L\/min|lpm)\b/i
  ], (v) => v / 60000, 'hydraulicFlow_M3_S', 'Hydraulic Flow');

  // Electrical parameters
  matchValue([
    /voltage\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:V|v)?/i
  ], undefined, 'motorVoltage_V', 'Motor Voltage');

  matchValue([
    /current\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:A|a)?/i
  ], undefined, 'motorCurrent_A', 'Motor Current');

  matchValue([
    /(?:power\s+factor|PF)\s*[:\s=]*\s*(\d+\.?\d*)/i
  ], undefined, 'powerFactor', 'Power Factor');

  const motorEffVal = matchValue([
    /efficiency\s*[:\s=]*\s*(\d+\.?\d*)\s*(%)?/i
  ], (v, match) => {
    const isPercent = match[2] === '%';
    if (isPercent || v > 1.0) return v / 100;
    return v;
  }, 'motorEfficiency', 'Motor Efficiency');
  if (motorEffVal === null) {
    values.motorEfficiency = 1.0;
    nodes.motorEfficiency = {
      name: 'Motor Efficiency',
      value: 1.0,
      type: 'SUGGESTED',
      source: 'Engine Default',
      formula: 'N/A',
      calculationSteps: 'Assumed 1.0 default motor efficiency',
      confidence: 'Medium',
      reasoning: 'Default 100% motor efficiency assumed.'
    };
  }

  // Bucket Elevator parameters
  matchValue([
    /capacity\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:TPH|tph|t\/h)?/i
  ], (v) => v * 1000 / 3600, 'bucketElevatorCapacity_kg_s', 'Bucket Elevator Capacity');

  matchValue([
    /(?:lift\s+height|liftHeight|height)\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m)?/i
  ], undefined, 'bucketElevatorLiftHeight_m', 'Lift Height');

  // 5. Fan & Pump Inputs
  matchValue([
    /(?:airflow|air\s+flow|flow\s+rate)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m3\/s|m³\/s|cfm)/i
  ], undefined, 'airflow_m3_s', 'Airflow Rate');

  matchValue([
    /(?:static\s+pressure|staticPressure|ΔP_static)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(Pa|pa)/i
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
    /(?:flow\s+rate|liquid\s+flow|Q)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(m3\/s|m³\/s)/i
  ], undefined, 'flowRate_m3_s', 'Pump Flow Rate');

  matchValue([
    /(?:pump\s+head|pumpHead|head|H)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m|meters)/i
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
    /(?:linear\s+speed|linearSpeed|velocity|travelSpeed|chain\s+speed|chainSpeed)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(?:m\/s)?/i
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

  matchValue([
    /(?:efficiency|gearboxEfficiency|η)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(%)?/i
  ], (v, match) => {
    const isPercent = match[2] === '%';
    if (isPercent || v > 1.0) return v / 100;
    return v;
  }, 'efficiency', 'Gearbox Efficiency');
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
    /(?:force|\bF\b|chain\s+pull|chainPull)\s*(?:is|of|was)?\s*[:\s=]*\s*(\d+\.?\d*)\s*(kN|N)?/i
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

    const assignSpeed = (paramKey: 'inputRadS' | 'outputRadS', name: string, val: number) => {
      const rads = val * (2 * Math.PI) / 60;
      values[paramKey] = rads;
      nodes[paramKey] = {
        name,
        value: rads,
        type: 'EXTRACTED',
        source: 'Customer RFQ Description',
        formula: 'N/A',
        calculationSteps: `Extracted generic speed: ${val} RPM -> ${rads.toFixed(3)} rad/s`,
        confidence: 'High',
        reasoning: 'Extracted RPM from generic text matching pattern as fallback and converted to rad/s.'
      };
    };

    if (!values.inputRadS && !values.outputRadS) {
      if (foundRpms.length >= 2) {
        assignSpeed('inputRadS', 'Input Speed', foundRpms[0]);
        assignSpeed('outputRadS', 'Output Speed', foundRpms[foundRpms.length - 1]);
      } else {
        const val = foundRpms[0];
        if (val >= 500) {
          assignSpeed('inputRadS', 'Input Speed', val);
        } else {
          assignSpeed('outputRadS', 'Output Speed', val);
        }
      }
    } else if (!values.inputRadS) {
      const outputRpmVal = values.outputRadS * 60 / (2 * Math.PI);
      const candidate = foundRpms.find(r => Math.abs(r - outputRpmVal) > 1);
      if (candidate !== undefined) {
        assignSpeed('inputRadS', 'Input Speed', candidate);
      }
    } else if (!values.outputRadS) {
      const inputRpmVal = values.inputRadS * 60 / (2 * Math.PI);
      const candidate = foundRpms.find(r => Math.abs(r - inputRpmVal) > 1);
      if (candidate !== undefined) {
        assignSpeed('outputRadS', 'Output Speed', candidate);
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
    name: 'Conveyor Belt Speed to Output RadS',
    category: 'Speed',
    requiredInputs: ['beltSpeed_m_s', 'pulleyDiameter_m'],
    outputParameter: 'outputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_out = 2 × v_belt / D_pulley',
    auditDescription: 'Derives the target output angular speed of a conveyor pulley from the required linear belt speed and pulley diameter.',
    formula: (inputs) => {
      const { beltSpeed_m_s, pulleyDiameter_m } = inputs;
      if (pulleyDiameter_m <= 0) return null;
      return (2 * beltSpeed_m_s) / pulleyDiameter_m;
    }
  },
  {
    id: 'DR-002',
    name: 'Chain Conveyor Speed to Output RadS',
    category: 'Speed',
    requiredInputs: ['chainSpeed_m_s', 'sprocketPCD_m'],
    outputParameter: 'outputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_out = 2 × v_chain / D_sprocket_PCD',
    auditDescription: 'Derives the target output angular speed of a chain conveyor from the chain speed and sprocket pitch circle diameter.',
    formula: (inputs) => {
      const { chainSpeed_m_s, sprocketPCD_m } = inputs;
      if (sprocketPCD_m <= 0) return null;
      return (2 * chainSpeed_m_s) / sprocketPCD_m;
    }
  },
  {
    id: 'DR-003',
    name: 'Bucket Elevator Speed to Output RadS',
    category: 'Speed',
    requiredInputs: ['bucketSpeed_m_s', 'headPulleyDiameter_m'],
    outputParameter: 'outputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_out = 2 × v_bucket / D_head_pulley',
    auditDescription: 'Derives target head shaft speed of a bucket elevator from bucket speed and head pulley diameter.',
    formula: (inputs) => {
      const { bucketSpeed_m_s, headPulleyDiameter_m } = inputs;
      if (headPulleyDiameter_m <= 0) return null;
      return (2 * bucketSpeed_m_s) / headPulleyDiameter_m;
    }
  },
  {
    id: 'DR-004',
    name: 'Hoist Speed to Drum RadS',
    category: 'Speed',
    requiredInputs: ['hoistSpeed_m_s', 'drumDiameter_m'],
    outputParameter: 'outputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_drum = 2 × v_lift / D_drum',
    auditDescription: 'Derives hoist drum speed from required lifting velocity and drum diameter.',
    formula: (inputs) => {
      const { hoistSpeed_m_s, drumDiameter_m } = inputs;
      if (drumDiameter_m <= 0) return null;
      return (2 * hoistSpeed_m_s) / drumDiameter_m;
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
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_shaft = Q_flow × ΔP_static / η_fan',
    auditDescription: 'Determines fan shaft power requirements from design static pressure rise, flow rate, and fan efficiency.',
    formula: (inputs) => {
      const { airflow_m3_s, staticPressure_Pa, fanEfficiency } = inputs;
      if (fanEfficiency <= 0) return null;
      return (airflow_m3_s * staticPressure_Pa) / fanEfficiency;
    }
  },
  {
    id: 'DR-009',
    name: 'Pump Power',
    category: 'Power',
    requiredInputs: ['flowRate_m3_s', 'pumpHead_m', 'pumpEfficiency', 'liquidDensity_kg_m3'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_shaft = ρ × g × Q × H / η_pump',
    auditDescription: 'Derives pump shaft power demand from liquid density, flow rate, head capacity, and pump efficiency.',
    formula: (inputs) => {
      const { flowRate_m3_s, pumpHead_m, pumpEfficiency, liquidDensity_kg_m3 } = inputs;
      if (pumpEfficiency <= 0) return null;
      return (liquidDensity_kg_m3 * 9.81 * flowRate_m3_s * pumpHead_m) / pumpEfficiency;
    }
  },
  {
    id: 'DR-010',
    name: 'Acceleration Torque',
    category: 'Torque',
    requiredInputs: ['systemInertia_kg_m2', 'deltaSpeed_RadS', 'accelTime_s'],
    outputParameter: 'accelerationTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'T_accel = J_total × Δω / t_accel',
    auditDescription: 'Calculates torque needed to accelerate inertia loads to operational speed within target time window.',
    formula: (inputs) => {
      const { systemInertia_kg_m2, deltaSpeed_RadS, accelTime_s } = inputs;
      if (accelTime_s <= 0) return null;
      return systemInertia_kg_m2 * (deltaSpeed_RadS / accelTime_s);
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
    name: 'Linear Speed to RadS',
    category: 'Speed',
    requiredInputs: ['linearSpeed_m_s', 'effectiveDiameter_m'],
    outputParameter: 'outputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω = 2 × v_linear / D_effective',
    auditDescription: 'Converts target linear travel velocity to equivalent shaft rotational speed in rad/s.',
    formula: (inputs) => {
      const { linearSpeed_m_s, effectiveDiameter_m } = inputs;
      if (effectiveDiameter_m <= 0) return null;
      return (2 * linearSpeed_m_s) / effectiveDiameter_m;
    }
  },
  {
    id: 'DR-013',
    name: 'Thermal Duty Cycle Power',
    category: 'Power',
    requiredInputs: ['designPower_W', 'onTime_min', 'offTime_min'],
    outputParameter: 'effectiveThermalPowerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_thermal = P_design × √ ( t_on / (t_on + t_off) )',
    auditDescription: 'Calculates equivalent continuous thermal power dissipation factor for periodic on/off cycles.',
    formula: (inputs) => {
      const { designPower_W, onTime_min, offTime_min } = inputs;
      const totalTime = onTime_min + offTime_min;
      if (totalTime <= 0) return null;
      return designPower_W * Math.sqrt(onTime_min / totalTime);
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
    requiredInputs: ['powerW', 'outputRadS'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Tout = (Pin × η) / ω_out',
    auditDescription: 'Calculates mechanical output shaft torque adjusted for losses across planetary stages.',
    formula: (inputs) => {
      const { powerW, outputRadS, efficiency, stages, totalRatio, inputRadS } = inputs;
      if (outputRadS <= 0) return null;
      let stagesCount = stages;
      if (stagesCount === undefined) {
        let ratio = totalRatio;
        if (ratio === undefined && inputRadS !== undefined && inputRadS > 0) {
          ratio = inputRadS / outputRadS;
        }
        if (ratio !== undefined && ratio > 0) {
          if (ratio <= 10.26) stagesCount = 1;
          else if (ratio <= 77.77) stagesCount = 2;
          else if (ratio <= 393.5) stagesCount = 3;
          else stagesCount = 4;
        }
      }
      const effVal = efficiency !== undefined ? efficiency : Math.pow(0.97, stagesCount || 1);
      return (powerW * effVal) / outputRadS;
    }
  },
  {
    id: 'DR-016',
    name: 'Input Speed and Ratio to Output Speed',
    category: 'Speed',
    requiredInputs: ['inputRadS', 'totalRatio'],
    outputParameter: 'outputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_out = ω_in / Ratio',
    auditDescription: 'Calculates target output speed from input speed and ratio.',
    formula: (inputs) => {
      const { inputRadS, totalRatio } = inputs;
      if (totalRatio <= 0) return null;
      return inputRadS / totalRatio;
    }
  },
  {
    id: 'DR-017',
    name: 'Input Speed and Output Speed to Ratio',
    category: 'Speed',
    requiredInputs: ['inputRadS', 'outputRadS'],
    outputParameter: 'totalRatio',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Ratio = ω_in / ω_out',
    auditDescription: 'Calculates overall gear ratio from input speed and output speed.',
    formula: (inputs) => {
      const { inputRadS, outputRadS } = inputs;
      if (outputRadS <= 0) return null;
      return inputRadS / outputRadS;
    }
  },
  {
    id: 'DR-018',
    name: 'Output Speed and Ratio to Input Speed',
    category: 'Speed',
    requiredInputs: ['outputRadS', 'totalRatio'],
    outputParameter: 'inputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_in = ω_out × Ratio',
    auditDescription: 'Calculates required input motor speed from output speed and ratio.',
    formula: (inputs) => {
      const { outputRadS, totalRatio } = inputs;
      return outputRadS * totalRatio;
    }
  },
  {
    id: 'DR-019',
    name: 'Motor Pole Count and Frequency to Input Speed',
    category: 'Speed',
    requiredInputs: ['motorPoles', 'frequencyHz'],
    outputParameter: 'inputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_in = ((120 × f / Poles) × (1 - Slip)) × 2π / 60',
    auditDescription: 'Calculates actual input motor speed from pole count and frequency, accounting for average motor slip.',
    formula: (inputs) => {
      const { motorPoles, frequencyHz } = inputs;
      if (motorPoles <= 0) return null;
      const sync = (120 * frequencyHz) / motorPoles;
      const rpm = sync * (1 - 0.033);
      return rpm * (2 * Math.PI) / 60;
    }
  },
  {
    id: 'DR-020',
    name: 'Output Torque and Output Speed to Power',
    category: 'Power',
    requiredInputs: ['outputTorqueNm', 'outputRadS', 'efficiency'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: false,
    formulaString: 'P_in = Tout × ω_out / η',
    auditDescription: 'Derives required input shaft power from output load torque, speed, and efficiency.',
    formula: (inputs) => {
      const { outputTorqueNm, outputRadS, efficiency } = inputs;
      if (efficiency <= 0 || outputRadS <= 0) return null;
      return (outputTorqueNm * outputRadS) / efficiency;
    }
  },
  {
    id: 'DR-021',
    name: 'Motor HP to Watt',
    category: 'Power',
    requiredInputs: ['motorHP'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_W = HP × 745.7',
    auditDescription: 'Converts motor HP rating to Watts.',
    formula: (inputs) => {
      return inputs.motorHP * 745.7;
    }
  },
  {
    id: 'DR-022',
    name: 'Screw Jack Linear Speed to Output RadS',
    category: 'Speed',
    requiredInputs: ['linearVelocityMS', 'screwPitchM'],
    outputParameter: 'outputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_out = 2π × v_linear / p_screw',
    auditDescription: 'Derives output speed for screw jack from linear travel velocity and screw pitch.',
    formula: (inputs) => {
      const { linearVelocityMS, screwPitchM } = inputs;
      if (screwPitchM <= 0) return null;
      return (2 * Math.PI * linearVelocityMS) / screwPitchM;
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
      if (r <= 10.26) return 1;
      if (r <= 77.77) return 2;
      if (r <= 393.5) return 3;
      return 4;
    }
  },
  {
    id: 'DR-024',
    name: 'Belt Power',
    category: 'Power',
    requiredInputs: ['beltPull_N', 'beltSpeed_m_s'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_eff × v_belt',
    auditDescription: 'Calculates design power from belt pull tension and linear travel speed.',
    formula: (inputs) => {
      return inputs.beltPull_N * inputs.beltSpeed_m_s;
    }
  },
  {
    id: 'DR-025',
    name: 'Hoist Load Power',
    category: 'Power',
    requiredInputs: ['hoistLoad_N', 'hoistSpeed_m_s'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_load × v_hoist',
    auditDescription: 'Calculates design power from hoist load force and linear hoist speed.',
    formula: (inputs) => {
      return inputs.hoistLoad_N * inputs.hoistSpeed_m_s;
    }
  },
  {
    id: 'DR-026',
    name: 'Line Pull Power',
    category: 'Power',
    requiredInputs: ['linePull_N', 'hoistSpeed_m_s'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = F_line × v_hoist',
    auditDescription: 'Calculates design power from winch line pull and hoist/winch speed.',
    formula: (inputs) => {
      return inputs.linePull_N * inputs.hoistSpeed_m_s;
    }
  },
  {
    id: 'DR-POWER-001',
    name: 'Output Torque and Speed to Input Power',
    category: 'Power',
    requiredInputs: ['outputTorqueNm', 'outputRadS'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P_in = T_out × ω_out / η',
    auditDescription: 'Derives required input shaft power from output load torque, speed, and efficiency.',
    formula: (inputs) => {
      const { outputTorqueNm, outputRadS, efficiency, stages, totalRatio } = inputs;
      if (outputRadS <= 0) return null;
      let stagesCount = stages;
      if (stagesCount === undefined && totalRatio) {
        stagesCount = totalRatio <= 10.26 ? 1 : totalRatio <= 77.77 ? 2 : totalRatio <= 393.5 ? 3 : 4;
      }
      const effVal = efficiency !== undefined ? efficiency : Math.pow(0.97, stagesCount || 1);
      return (outputTorqueNm * outputRadS) / effVal;
    }
  },
  {
    id: 'DR-POWER-002',
    name: 'Force and Velocity to Power',
    category: 'Power',
    requiredInputs: ['force_N', 'linearSpeed_m_s'],
    outputParameter: 'powerW',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'P = Force × Velocity',
    auditDescription: 'Derives power from generic force in Newtons and linear velocity in m/s.',
    formula: (inputs) => {
      return inputs.force_N * inputs.linearSpeed_m_s;
    }
  },
  {
    id: 'DR-POWER-003',
    name: 'Load and Speed to Power',
    category: 'Power',
    requiredInputs: ['load_kg', 'linearSpeed_m_s'],
    outputParameter: 'powerW',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'P = Load_kg × g × Speed',
    auditDescription: 'Derives power from load in kg and velocity in m/s.',
    formula: (inputs) => {
      return inputs.load_kg * 9.81 * inputs.linearSpeed_m_s;
    }
  },
  {
    id: 'DR-POWER-005',
    name: 'Input Torque and Input Speed to Power',
    category: 'Power',
    requiredInputs: ['inputTorqueNm', 'inputRadS'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = T_in × ω_in',
    auditDescription: 'Derives power from input torque and rotational speed directly.',
    formula: (inputs) => {
      const { inputTorqueNm, inputRadS } = inputs;
      if (inputRadS <= 0) return null;
      return inputTorqueNm * inputRadS;
    }
  },
  {
    id: 'DR-POWER-006',
    name: 'Hydraulic Pressure and Flow to Power',
    category: 'Power',
    requiredInputs: ['hydraulicPressure_Pa', 'hydraulicFlow_M3_S'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = Pressure × Flow',
    auditDescription: 'Calculates hydraulic power from operating pressure in Pascals and flow in m3/s.',
    formula: (inputs) => {
      const { hydraulicPressure_Pa, hydraulicFlow_M3_S } = inputs;
      if (hydraulicPressure_Pa <= 0 || hydraulicFlow_M3_S <= 0) return null;
      return hydraulicPressure_Pa * hydraulicFlow_M3_S;
    }
  },
  {
    id: 'DR-POWER-007',
    name: 'Electrical Motor Parameters to Power',
    category: 'Power',
    requiredInputs: ['motorVoltage_V', 'motorCurrent_A', 'powerFactor', 'motorEfficiency'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = √3 × V × I × PF × η',
    auditDescription: 'Calculates motor shaft power from voltage, current, power factor, and efficiency.',
    formula: (inputs) => {
      const { motorVoltage_V, motorCurrent_A, powerFactor, motorEfficiency } = inputs;
      if (motorVoltage_V <= 0 || motorCurrent_A <= 0 || powerFactor <= 0 || motorEfficiency <= 0) return null;
      return Math.sqrt(3) * motorVoltage_V * motorCurrent_A * powerFactor * motorEfficiency;
    }
  },
  {
    id: 'DR-POWER-008',
    name: 'Bucket Elevator Capacity and Lift Height to Power',
    category: 'Power',
    requiredInputs: ['bucketElevatorCapacity_kg_s', 'bucketElevatorLiftHeight_m', 'motorEfficiency'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = (m_dot × g × H) / η',
    auditDescription: 'Calculates bucket elevator required power from mass flow rate, lift height, and efficiency.',
    formula: (inputs) => {
      const { bucketElevatorCapacity_kg_s, bucketElevatorLiftHeight_m, motorEfficiency } = inputs;
      if (bucketElevatorCapacity_kg_s <= 0 || bucketElevatorLiftHeight_m <= 0 || motorEfficiency <= 0) return null;
      return (bucketElevatorCapacity_kg_s * 9.81 * bucketElevatorLiftHeight_m) / motorEfficiency;
    }
  },
  {
    id: 'DR-POWER-011',
    name: 'Load and Hoist Speed to Power',
    category: 'Power',
    requiredInputs: ['load_kg', 'hoistSpeed_m_s'],
    outputParameter: 'powerW',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'P = Load_kg × g × v_hoist',
    auditDescription: 'Derives power from load in kg and hoist lift speed in m/s.',
    formula: (inputs) => {
      return inputs.load_kg * 9.81 * inputs.hoistSpeed_m_s;
    }
  },
  {
    id: 'DR-POWER-004',
    name: 'Estimate Power from Gear Capacity',
    category: 'Power',
    requiredInputs: ['torqueCapacity', 'outputRadS'],
    outputParameter: 'powerW',
    confidence: 'LOW',
    autoCalculate: true,
    formulaString: 'P = torqueCapacity × ω_out',
    auditDescription: 'Estimates power capability from gear bending torque capacity and speed.',
    formula: (inputs) => {
      const { torqueCapacity, outputRadS } = inputs;
      if (outputRadS <= 0) return null;
      return torqueCapacity * outputRadS;
    }
  },
  {
    id: 'DR-TORQUE-001',
    name: 'Power and Speed to Torque (Standard)',
    category: 'Torque',
    requiredInputs: ['powerW', 'outputRadS'],
    outputParameter: 'outputTorqueNm',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'T_out = P_in × η / ω_out',
    auditDescription: 'Calculates standard output torque from input power, output speed, and efficiency.',
    formula: (inputs) => {
      const { powerW, outputRadS, efficiency, stages, totalRatio } = inputs;
      if (outputRadS <= 0) return null;
      let stagesCount = stages;
      if (stagesCount === undefined && totalRatio) {
        stagesCount = totalRatio <= 10.26 ? 1 : totalRatio <= 77.77 ? 2 : totalRatio <= 393.5 ? 3 : 4;
      }
      const effVal = efficiency !== undefined ? efficiency : Math.pow(0.97, stagesCount || 1);
      return (powerW * effVal) / outputRadS;
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
    requiredInputs: ['powerW', 'outputTorqueNm'],
    outputParameter: 'outputRadS',
    confidence: 'MEDIUM',
    autoCalculate: true,
    formulaString: 'ω_out = P_in × η / T_out',
    auditDescription: 'Calculates angular speed in rad/s from input power in Watts, output torque in Nm, and efficiency.',
    formula: (inputs) => {
      const { powerW, outputTorqueNm, efficiency, stages, totalRatio } = inputs;
      if (outputTorqueNm <= 0) return null;
      let stagesCount = stages;
      if (stagesCount === undefined && totalRatio) {
        stagesCount = totalRatio <= 10.26 ? 1 : totalRatio <= 77.77 ? 2 : totalRatio <= 393.5 ? 3 : 4;
      }
      const effVal = efficiency !== undefined ? efficiency : Math.pow(0.97, stagesCount || 1);
      return (powerW * effVal) / outputTorqueNm;
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
  },
  {
    id: 'DR-RATIO-004',
    name: 'Torque Ratio (Efficiency-Corrected)',
    category: 'Ratio',
    requiredInputs: ['outputTorqueNm', 'inputTorqueNm'],
    outputParameter: 'totalRatio',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Ratio = Tout / (Tin * η)',
    auditDescription: 'Derives overall gear reduction ratio from output torque and input torque accounting for stage efficiency losses.',
    formula: (inputs) => {
      const { outputTorqueNm, inputTorqueNm, efficiency, stages } = inputs;
      if (inputTorqueNm <= 0) return null;
      let stagesCount = stages;
      if (stagesCount === undefined) {
        const ratioGuess = outputTorqueNm / inputTorqueNm;
        if (ratioGuess <= 10.26) stagesCount = 1;
        else if (ratioGuess <= 77.77) stagesCount = 2;
        else if (ratioGuess <= 393.5) stagesCount = 3;
        else stagesCount = 4;
      }
      const effVal = efficiency !== undefined ? efficiency : Math.pow(0.97, stagesCount || 1);
      return outputTorqueNm / (inputTorqueNm * effVal);
    }
  },
  {
    id: 'DR-RPM-003',
    name: 'Power and Input Torque to Speed',
    category: 'Speed',
    requiredInputs: ['powerW', 'inputTorqueNm'],
    outputParameter: 'inputRadS',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'ω_in = P / T_in',
    auditDescription: 'Derives motor input speed in rad/s from rated motor power and input torque.',
    formula: (inputs) => {
      const { powerW, inputTorqueNm } = inputs;
      if (inputTorqueNm <= 0) return null;
      return powerW / inputTorqueNm;
    }
  },
  {
    id: 'DR-TORQUE-007',
    name: 'Output Torque and Ratio to Input Torque',
    category: 'Torque',
    requiredInputs: ['outputTorqueNm', 'totalRatio'],
    outputParameter: 'inputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Tin = Tout / (Ratio * η)',
    auditDescription: 'Derives input motor torque from output load torque, gearbox ratio, and efficiency.',
    formula: (inputs) => {
      const { outputTorqueNm, totalRatio, efficiency, stages } = inputs;
      if (totalRatio <= 0) return null;
      let stagesCount = stages;
      if (stagesCount === undefined) {
        if (totalRatio <= 10.26) stagesCount = 1;
        else if (totalRatio <= 77.77) stagesCount = 2;
        else if (totalRatio <= 393.5) stagesCount = 3;
        else stagesCount = 4;
      }
      const effVal = efficiency !== undefined ? efficiency : Math.pow(0.97, stagesCount || 1);
      return outputTorqueNm / (totalRatio * effVal);
    }
  },
  {
    id: 'DR-TORQUE-008',
    name: 'Input Torque and Ratio to Output Torque',
    category: 'Torque',
    requiredInputs: ['inputTorqueNm', 'totalRatio'],
    outputParameter: 'outputTorqueNm',
    confidence: 'HIGH',
    autoCalculate: true,
    formulaString: 'Tout = Tin * Ratio * η',
    auditDescription: 'Derives output load torque from input motor torque, gearbox ratio, and efficiency.',
    formula: (inputs) => {
      const { inputTorqueNm, totalRatio, efficiency, stages } = inputs;
      if (totalRatio <= 0) return null;
      let stagesCount = stages;
      if (stagesCount === undefined) {
        if (totalRatio <= 10.26) stagesCount = 1;
        else if (totalRatio <= 77.77) stagesCount = 2;
        else if (totalRatio <= 393.5) stagesCount = 3;
        else stagesCount = 4;
      }
      const effVal = efficiency !== undefined ? efficiency : Math.pow(0.97, stagesCount || 1);
      return inputTorqueNm * totalRatio * effVal;
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
      const rules = derivationRules.filter((r) => r.outputParameter === param && r.autoCalculate !== false).sort((a, b) => {
        const explicitA = a.requiredInputs.filter(i => userProvidedKeys.has(i)).length;
        const explicitB = b.requiredInputs.filter(i => userProvidedKeys.has(i)).length;
        if (explicitA !== explicitB) {
          return explicitB - explicitA;
        }
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
                ...derivedParameters
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
                ...derivedParameters
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
              ...derivedParameters
            };
            const result = rule.formula(formulaInputs);
            if (result !== null && result !== undefined && !isNaN(result)) {
              derivedParameters[param] = result;
              
              if (!traces.some((t) => t.ruleId === rule.id)) {
                let assumptionsCount = 0;
                for (const inputKey of rule.requiredInputs) {
                  const isExplicit = userProvidedKeys.has(inputKey);
                  if (!isExplicit) {
                    const inputTrace = traces.find(t => t.outputProduced.startsWith(inputKey));
                    if (inputTrace) {
                      if (inputTrace.confidence === 'LOW') {
                        assumptionsCount += 2;
                      } else if (inputTrace.confidence === 'MEDIUM') {
                        assumptionsCount += 1;
                      }
                    } else {
                      assumptionsCount++;
                    }
                  }
                }

                let traceConf: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
                if (assumptionsCount === 1) {
                  traceConf = 'MEDIUM';
                } else if (assumptionsCount > 1) {
                  traceConf = 'LOW';
                }

                let traceType: 'EXTRACTED' | 'CALCULATED' | 'DERIVED' | 'SUGGESTED' | 'ASSUMED' | 'ENGINE_RULE' | 'ASSUMED_VALUE' = 'ENGINE_RULE';
                if (rule.requiredInputs.includes('efficiency') && !userProvidedKeys.has('efficiency')) {
                  traceType = 'ASSUMED_VALUE';
                }

                const hasUsedAssumedEfficiency = (rule.id === 'DR-015' || rule.id === 'DR-RATIO-004' || rule.id === 'DR-TORQUE-007' || rule.id === 'DR-TORQUE-008') && !userProvidedKeys.has('efficiency');
                if (hasUsedAssumedEfficiency) {
                  traceType = 'ASSUMED_VALUE';
                  if (traceConf !== 'LOW') {
                    traceConf = 'MEDIUM';
                  }
                }

                traces.push({
                  ruleId: rule.id,
                  ruleName: rule.name,
                  inputsUsed: formulaInputs,
                  formulaUsed: rule.formulaString,
                  outputProduced: `${rule.outputParameter} = ${typeof result === 'number' ? result.toFixed(3) : result}`,
                  value: result,
                  timestamp: new Date().toISOString(),
                  confidence: traceConf,
                  type: traceType
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


    // Try resolving all possible target output parameters in a fixed-point iteration loop
    const allTargets = Array.from(new Set(derivationRules.map((r) => r.outputParameter)));
    allTargets.sort((a, b) => {
      const priority: Record<string, number> = {
        inputRadS: 1,
        inputRPM: 1,
        outputRadS: 2,
        outputRPM: 2,
        totalRatio: 3,
        stages: 4,
        efficiency: 5
      };
      const pA = priority[a] !== undefined ? priority[a] : 99;
      const pB = priority[b] !== undefined ? priority[b] : 99;
      return pA - pB;
    });
    let lastResolvedCount = -1;
    let currentResolvedCount = 0;
    while (currentResolvedCount > lastResolvedCount) {
      lastResolvedCount = currentResolvedCount;
      for (const target of allTargets) {
        resolveParameter(target, new Set());
      }
      currentResolvedCount = Object.keys(derivedParameters).length;
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

