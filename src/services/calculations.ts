/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * COMPLETE ENGINEERING CALCULATION ENGINE
 * PART 1
 *
 * Sections Implemented:
 * - Interfaces
 * - Constants Database
 * - Validation Engine
 * - Power/Torque Conversion
 * - Motor RPM Derivation
 * - Ratio Engine
 * - Stage Count Engine
 *
 ***********************************************************************/

///////////////////////////////
// ENUMS & TYPES
///////////////////////////////

import type { GearboxInput } from "../types/Gearbox";

export type LoadType = "uniform" | "variable" | "heavy_shock";



export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type Recommendation = "PREFERRED" | "ACCEPTABLE" | "MARGINAL" | "REJECT" | "PREFERRED_WITH_WARNING" | "ENGINEERING_REVIEW_REQUIRED";

export type ValidationSeverity = "ERROR" | "WARNING" | "INFO";

export type DerivationMethod = "provided" | "calculated" | "lookup" | "default";

export type { GearboxInput };

///////////////////////////////
// DERIVATION LOG
///////////////////////////////

export interface DerivationEntry {
  parameter: string;

  method: DerivationMethod;

  value: number | string;

  formula?: string;

  confidence: ConfidenceLevel;

  source?: string;
}

///////////////////////////////
// VALIDATION FLAG
///////////////////////////////

export interface ValidationFlag {
  severity: ValidationSeverity;

  parameter: string;

  message: string;

  action: string;
}

///////////////////////////////
// CALCULATION RESULT
///////////////////////////////

export interface CalculationResult {
  input_torque_nm: number;

  output_torque_nm: number;

  total_ratio: number;

  stage_count: number;

  stage_ratios: number[];

  stage_torques: number[];

  stage_speeds: number[];

  service_factor: number;

  required_nominal_nm: number;

  required_maximum_nm: number;

  overall_efficiency: number;

  derivation_log: DerivationEntry[];

  flags: ValidationFlag[];

  confidence: ConfidenceLevel;
}

///////////////////////////////
// GEARBOX CANDIDATE
///////////////////////////////

export interface GearboxCandidate {
  model_id: string;

  nominal_torque: number;

  max_torque: number;

  actual_ratio: number;

  max_input_rpm: number;

  safety_factor: number;

  recommendation: Recommendation;
}

///////////////////////////////
// AUDIT TRAIL
///////////////////////////////

export interface AuditTrail {
  session_id: string;

  timestamp: string;

  input_raw: GearboxInput;

  input_resolved: GearboxInput;

  derivations: DerivationEntry[];

  calculations: CalculationResult;

  candidates: GearboxCandidate[];

  recommendation: GearboxCandidate;

  flags: ValidationFlag[];

  engineer_review_required: boolean;

  confidence_score: number;
}

//////////////////////////////////////////////////////////////////
// ENGINEERING CONSTANTS
//////////////////////////////////////////////////////////////////

export const ENGINEERING_CONSTANTS = {
  PI: Math.PI,

  HP_TO_KW: 0.7457,

  KW_TO_HP: 1 / 0.7457,

  TORQUE_CONSTANT: 9549.3,

  PLANETARY_STAGE_EFFICIENCY: 0.97,

  AVG_MOTOR_SLIP: 0.033,

  DEFAULT_SERVICE_FACTOR: 1.5,

  MAX_SERVICE_FACTOR: 3.0,
};

//////////////////////////////////////////////////////////////////
// STAGE LIMIT DATABASE
//////////////////////////////////////////////////////////////////

export const STAGE_LIMITS = [
  {
    stage: 1,
    min: 3.75,
    max: 10.26,
  },

  {
    stage: 2,
    min: 4.71,
    max: 7.58,
  },

  {
    stage: 3,
    min: 4.76,
    max: 5.06,
  },

  {
    stage: 4,
    min: 4.0,
    max: 4.5,
  },
];

//////////////////////////////////////////////////////////////////
// STAGE MAX RATIOS
//////////////////////////////////////////////////////////////////

export const STAGE_MAX_RATIO = {
  ONE_STAGE: 10.26,

  TWO_STAGE: 77.77,

  THREE_STAGE: 393.52,

  FOUR_STAGE: 1770.84,
};

//////////////////////////////////////////////////////////////////
// VALIDATION LIMITS
//////////////////////////////////////////////////////////////////

export const VALIDATION_LIMITS = {
  POWER_W: {
    min: 100,
    max: 10000000,
  },

  INPUT_RADS: {
    min: 100 * 2 * Math.PI / 60,
    max: 10000 * 2 * Math.PI / 60,
  },

  OUTPUT_RADS: {
    min: 0.1 * 2 * Math.PI / 60,
    max: 5000 * 2 * Math.PI / 60,
  },

  RATIO: {
    min: 1,
    max: 2000,
  },

  TORQUE: {
    min: 1,
    max: 5000000,
  },

  SERVICE_FACTOR: {
    min: 1,
    max: 3,
  },

  PITCH_M: {
    min: 0.001,
    max: 0.1,
  },

  AXIAL_LOAD_N: {
    min: 100,
    max: 10000000,
  },
};

//////////////////////////////////////////////////////////////////
// VALIDATION ENGINE
//////////////////////////////////////////////////////////////////

export class ValidationEngine {
  static validateInput(input: GearboxInput): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    if (
      input.powerW &&
      (input.powerW < VALIDATION_LIMITS.POWER_W.min ||
        input.powerW > VALIDATION_LIMITS.POWER_W.max)
    ) {
      flags.push({
        severity: "WARNING",
        parameter: "powerW",
        message: "Power outside valid engineering range",
        action: "Verify units or motor specification",
      });
    }

    if (
      input.inputRadS &&
      (input.inputRadS < VALIDATION_LIMITS.INPUT_RADS.min ||
        input.inputRadS > VALIDATION_LIMITS.INPUT_RADS.max)
    ) {
      flags.push({
        severity: "WARNING",
        parameter: "inputRadS",
        message: "Input speed outside normal motor range",
        action: "Verify motor speed",
      });
    }

    if (
      input.totalRatio &&
      (input.totalRatio < VALIDATION_LIMITS.RATIO.min ||
        input.totalRatio > VALIDATION_LIMITS.RATIO.max)
    ) {
      flags.push({
        severity: "ERROR",
        parameter: "totalRatio",
        message: "Ratio outside planetary gearbox range",
        action: "Review gearbox architecture",
      });
    }

    return flags;
  }
}

//////////////////////////////////////////////////////////////////
// POWER / TORQUE ENGINE
//////////////////////////////////////////////////////////////////

export class PowerTorqueEngine {
  ////////////////////////////////////
  // Torque from Power & Speed
  ////////////////////////////////////

  static calcTorque(powerW: number, speedRadS: number): number {
    return powerW / speedRadS;
  }

  ////////////////////////////////////
  // Power from Torque & Speed
  ////////////////////////////////////

  static calcPower(torqueNm: number, speedRadS: number): number {
    return torqueNm * speedRadS;
  }

  static formatTorqueExact(val: number): string {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    if (val % 1 === 0) {
      return val.toLocaleString();
    }
    const str = val.toString();
    if (str.includes('e')) {
      const fixed = val.toFixed(14).replace(/\.?0+$/, '');
      const parts = fixed.split('.');
      parts[0] = Number(parts[0]).toLocaleString();
      return parts.join('.');
    }
    const parts = str.split('.');
    parts[0] = Number(parts[0]).toLocaleString();
    return parts.join('.');
  }

  ////////////////////////////////////
  // HP → kW
  ////////////////////////////////////

  static hpToKw(hp: number): number {
    return hp * ENGINEERING_CONSTANTS.HP_TO_KW;
  }

  ////////////////////////////////////
  // kW → HP
  ////////////////////////////////////

  static kwToHp(kw: number): number {
    return kw * ENGINEERING_CONSTANTS.KW_TO_HP;
  }
}

//////////////////////////////////////////////////////////////////
// MOTOR RPM DERIVATION
//////////////////////////////////////////////////////////////////

export class MotorSpeedEngine {
  ////////////////////////////////////
  // Synchronous rad/s
  ////////////////////////////////////

  static synchronousSpeed(poles: number, hz: number): number {
    return (4 * Math.PI * hz) / poles;
  }

  ////////////////////////////////////
  // Actual rad/s
  ////////////////////////////////////

  static actualSpeed(poles: number, hz: number): number {
    const sync = this.synchronousSpeed(poles, hz);

    return sync * (1 - ENGINEERING_CONSTANTS.AVG_MOTOR_SLIP);
  }

  ////////////////////////////////////
  // AI Derivation Rule
  ////////////////////////////////////

  static deriveRadS(poles?: number, hz?: number): number | undefined {
    if (poles && hz) {
      return this.actualSpeed(poles, hz);
    }

    return undefined;
  }

  static snapToStandardSpeed(calculatedRadS: number): { snapped: number; isSnapped: boolean } {
    const standardsRPM = [720, 960, 1450, 2900];
    const standards = standardsRPM.map(rpm => rpm * 2 * Math.PI / 60);
    for (let i = 0; i < standards.length; i++) {
      const std = standards[i];
      const minVal = std * 0.9;
      const maxVal = std * 1.1;
      if (calculatedRadS >= minVal && calculatedRadS <= maxVal) {
        return { snapped: std, isSnapped: true };
      }
    }
    return { snapped: calculatedRadS, isSnapped: false };
  }
}

//////////////////////////////////////////////////////////////////
// RATIO ENGINE
//////////////////////////////////////////////////////////////////

export class RatioEngine {
  static calculateRatio(inputRadS: number, outputRadS: number): number {
    return inputRadS / outputRadS;
  }

  static outputRadS(inputRadS: number, ratio: number): number {
    return inputRadS / ratio;
  }

  static inputRadS(outputRadS: number, ratio: number): number {
    return outputRadS * ratio;
  }
}

//////////////////////////////////////////////////////////////////
// STAGE COUNT ENGINE
//////////////////////////////////////////////////////////////////

export class StageCountEngine {
  static determineStageCount(ratio: number): number {
    if (ratio <= 10) {
      return 1;
    }

    if (ratio <= 80) {
      return 2;
    }

    if (ratio <= 500) {
      return 3;
    }

    return 4;
  }
}


//////////////////////////////////////////////////////////////////
// QUICK TESTS
//////////////////////////////////////////////////////////////////

console.log("Torque:", PowerTorqueEngine.calcTorque(15, 1440));

console.log("Power:", PowerTorqueEngine.calcPower(99.47, 1440));

console.log("RPM:", MotorSpeedEngine.actualSpeed(4, 50));

console.log("Ratio:", RatioEngine.calculateRatio(1440, 20));

console.log("Stages:", StageCountEngine.determineStageCount(72));

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 2
 *
 * Sections Implemented:
 * - Stage Ratio Distribution Engine
 * - Torque Propagation Engine
 * - Screw Jack Calculations
 * - Service Factor Engine
 * - Safety Factor Engine
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// EFFICIENCY TABLES
//////////////////////////////////////////////////////////////

export const EFFICIENCY = {
  PER_STAGE: 0.97,

  ONE_STAGE: Math.pow(0.97, 1),
  TWO_STAGE: Math.pow(0.97, 2),
  THREE_STAGE: Math.pow(0.97, 3),
  FOUR_STAGE: Math.pow(0.97, 4),
};

//////////////////////////////////////////////////////////////
// SERVICE FACTOR DATABASE
//////////////////////////////////////////////////////////////

export const SERVICE_FACTOR_DATABASE = {
  centrifugal_pump: {
    base: 1.25,
    duty24: 1.5,
    starts10: 1.75,
  },

  agitator: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  mixer: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  conveyor_belt: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  conveyor_chain: {
    base: 1.75,
    duty24: 2.0,
    starts10: 2.25,
  },

  screw_jack: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.0,
  },

  compressor: {
    base: 1.5,
    duty24: 1.75,
    starts10: 2.25,
  },

  crusher_primary: {
    base: 2.0,
    duty24: 2.5,
    starts10: 3.0,
  },

  crusher_secondary: {
    base: 2.25,
    duty24: 2.75,
    starts10: 3.0,
  },

  mining_hoist: {
    base: 2.0,
    duty24: 2.5,
    starts10: 2.5,
  },

  stacker_reclaimer: {
    base: 1.75,
    duty24: 2.0,
    starts10: 2.25,
  },

  heavy_shock: {
    base: 3.0,
    duty24: 3.0,
    starts10: 3.0,
  },

  test_bench: {
    base: 1.0,
    duty24: 1.25,
    starts10: 1.5,
  },
};

//////////////////////////////////////////////////////////////
// STAGE DISTRIBUTION ENGINE
//////////////////////////////////////////////////////////////

export class StageDistributionEngine {
  static distributeRatio(totalRatio: number, stageCount: number): number[] {
    const limits = [
      { min: 3.75, max: 10.26 },
      { min: 4.71, max: 7.58 },
      { min: 4.76, max: 5.06 },
      { min: 4.0, max: 4.5 },
    ];

    const ratios = Array(stageCount).fill(Math.pow(totalRatio, 1 / stageCount));

    let residual = totalRatio;

    for (let i = stageCount - 1; i >= 0; i--) {
      ratios[i] = Math.max(limits[i].min, Math.min(limits[i].max, ratios[i]));

      residual = residual / ratios[i];

      if (i > 0) {
        const remaining = Math.pow(residual, 1 / i);

        for (let j = 0; j < i; j++) {
          ratios[j] = remaining;
        }
      }
    }

    return ratios;
  }
}

//////////////////////////////////////////////////////////////
// TORQUE PROPAGATION ENGINE
//////////////////////////////////////////////////////////////

export class TorquePropagationEngine {
  static propagateTorques(
    inputTorque: number,
    stageRatios: number[],
    efficiency = 0.97,
  ): number[] {
    const torques = [inputTorque];

    for (const ratio of stageRatios) {
      const nextTorque = torques[torques.length - 1] * ratio * efficiency;

      torques.push(nextTorque);
    }

    return torques;
  }

  static propagateSpeeds(inputRPM: number, stageRatios: number[]): number[] {
    const speeds = [inputRPM];

    for (const ratio of stageRatios) {
      const nextSpeed = speeds[speeds.length - 1] / ratio;

      speeds.push(nextSpeed);
    }

    return speeds;
  }

  static overallEfficiency(stageCount: number): number {
    return Math.pow(0.97, stageCount);
  }
}

//////////////////////////////////////////////////////////////
// SCREW JACK ENGINE
//////////////////////////////////////////////////////////////

export class ScrewJackEngine {
  //////////////////////////////////////////////////
  // Output RPM from Linear Velocity
  //////////////////////////////////////////////////

  static outputRPM(velocity_mm_min: number, pitch_mm_rev: number): number {
    return velocity_mm_min / pitch_mm_rev;
  }

  //////////////////////////////////////////////////
  // Travel Time
  //////////////////////////////////////////////////

  static travelTimeMinutes(stroke_mm: number, velocity_mm_min: number): number {
    return stroke_mm / velocity_mm_min;
  }

  //////////////////////////////////////////////////
  // Revolutions for Stroke
  //////////////////////////////////////////////////

  static revolutionsForStroke(stroke_mm: number, pitch_mm_rev: number): number {
    return stroke_mm / pitch_mm_rev;
  }

  //////////////////////////////////////////////////
  // Lifting Torque
  //////////////////////////////////////////////////

  static liftingTorque(
    axialLoadN: number,
    pitch_mm: number,
    screwEfficiency: number,
  ): number {
    return (axialLoadN * pitch_mm) / (2000 * Math.PI * screwEfficiency);
  }

  //////////////////////////////////////////////////
  // Lowering Torque
  //////////////////////////////////////////////////

  static loweringTorque(
    axialLoadN: number,
    pitch_mm: number,
    screwEfficiency: number,
  ): number {
    return (axialLoadN * pitch_mm * screwEfficiency) / (2000 * Math.PI);
  }
}

//////////////////////////////////////////////////////////////
// SERVICE FACTOR ENGINE
//////////////////////////////////////////////////////////////

interface SFBracket {
  defaultSF: number;
  minSF: number;
  maxSF: number;
}

export class ServiceFactorEngine {
  static getSFBracket(application: string): SFBracket {
    const app = application.toLowerCase();
    if (app.includes("conveyor")) return { defaultSF: 1.25, minSF: 1.0, maxSF: 1.5 };
    if (app.includes("crusher")) return { defaultSF: 2.0, minSF: 1.75, maxSF: 2.5 };
    if (app.includes("agitator")) return { defaultSF: 1.3, minSF: 1.1, maxSF: 1.6 };
    if (app.includes("elevator")) return { defaultSF: 1.5, minSF: 1.3, maxSF: 1.75 };
    if (app.includes("winch")) return { defaultSF: 1.4, minSF: 1.2, maxSF: 1.8 };
    if (app.includes("jack")) return { defaultSF: 1.25, minSF: 1.0, maxSF: 1.5 };
    if (app.includes("mixer")) return { defaultSF: 1.5, minSF: 1.25, maxSF: 2.0 };
    return { defaultSF: 1.5, minSF: 1.0, maxSF: 3.0 }; // fallback
  }

  static calculate(
    application: string,
    dutyHours: number,
    startsPerHour: number,
    environment?: string,
  ): number {
    const bracket = this.getSFBracket(application);
    let sf = bracket.defaultSF;

    if (dutyHours > 16) {
      sf += 0.25;
    }

    if (startsPerHour > 10) {
      sf += 0.25;
    }

    if (
      environment &&
      (environment.includes("dust") ||
        environment.includes("humid") ||
        environment.includes("outdoor"))
    ) {
      sf += 0.25;
    }

    return Math.max(bracket.minSF, Math.min(sf, bracket.maxSF));
  }
}

//////////////////////////////////////////////////////////////
// PEAK FACTOR ENGINE
//////////////////////////////////////////////////////////////

export class PeakFactorEngine {
  static getPeakFactor(application: string): number {
    const app = application.toLowerCase();

    if (app.includes("crusher")) {
      return 2.0;
    }

    if (app.includes("emergency")) {
      return 2.5;
    }

    return 1.5;
  }
}

//////////////////////////////////////////////////////////////
// THERMAL RATING ENGINE
//////////////////////////////////////////////////////////////

export class ThermalRatingEngine {
  static calculateAmbientFactor(ambientTemp?: number): number {
    const temp = ambientTemp ?? 20;
    return Math.max(0.1, 1.0 - 0.015 * (temp - 20));
  }

  static verifyThermalLimit(
    transmittedPowerKW: number,
    baseThermalCapacityKW: number,
    ambientTemp?: number,
  ): { isSafe: boolean; capacity: number; factor: number } {
    const factor = this.calculateAmbientFactor(ambientTemp);
    const capacity = baseThermalCapacityKW * factor;
    return {
      isSafe: transmittedPowerKW <= capacity,
      capacity,
      factor
    };
  }
}

//////////////////////////////////////////////////////////////
// MOUNTING POSITION ENGINE
//////////////////////////////////////////////////////////////

export class MountingPositionEngine {
  static verifyMounting(
    position?: 'horizontal' | 'vertical_up' | 'vertical_down',
    thrustLoadN?: number,
    thrustLoadRatingN?: number,
  ): { isAllowed: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let isAllowed = true;

    if (position && position.startsWith('vertical')) {
      warnings.push(`Vertical configuration requires dynamic dry-well seals and forced splash lubrication.`);
      if (thrustLoadN !== undefined && thrustLoadRatingN !== undefined) {
        if (thrustLoadN > thrustLoadRatingN) {
          isAllowed = false;
          warnings.push(`Axial thrust load of ${thrustLoadN} N exceeds vertical thrust capacity of ${thrustLoadRatingN} N.`);
        }
      }
    }

    return { isAllowed, warnings };
  }
}

//////////////////////////////////////////////////////////////
// SAFETY FACTOR ENGINE
//////////////////////////////////////////////////////////////

export class SafetyFactorEngine {
  static calculate(
    gearboxNominal: number,
    gearboxRated: number,
    requiredNominal: number,
    requiredMaximum: number,
  ): number {
    const sfNominal = gearboxNominal / requiredNominal;

    const sfRated = gearboxRated / requiredMaximum;

    return Math.min(sfNominal, sfRated);
  }

  static assessment(sf: number): string {
    if (sf < 1.0) return "FAIL";

    if (sf < 1.1) return "MARGINAL";

    if (sf < 1.25) return "ACCEPTABLE";

    if (sf < 1.5) return "GOOD";

    if (sf < 2.0) return "CONSERVATIVE";

    return "OVER_DESIGNED";
  }
}

//////////////////////////////////////////////////////////////
// REQUIRED TORQUE ENGINE
//////////////////////////////////////////////////////////////

export class RequiredTorqueEngine {
  static requiredNominal(outputTorque: number, serviceFactor: number): number {
    return outputTorque * serviceFactor;
  }

  static requiredMaximum(
    outputTorque: number,
    serviceFactor: number,
    peakFactor: number,
  ): number {
    return outputTorque * serviceFactor * peakFactor;
  }
}

//////////////////////////////////////////////////////////////
// TEST EXAMPLES
//////////////////////////////////////////////////////////////

const screwTorque = ScrewJackEngine.liftingTorque(35500, 6, 0.4);

console.log("Screw Torque:", screwTorque);

const sf = ServiceFactorEngine.calculate("belt conveyor", 12, 5);

console.log("Service Factor:", sf);

const ratios = StageDistributionEngine.distributeRatio(88.5, 3);

console.log("Ratios:", ratios);

const torques = TorquePropagationEngine.propagateTorques(99.47, ratios);

console.log("Stage Torques:", torques);

const safety = SafetyFactorEngine.calculate(15000, 22000, 14042, 21063);

console.log("Safety Factor:", safety);

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 3
 *
 * Sections Implemented:
 * - Missing Data Resolution Engine
 * - Parameter Extraction Engine
 * - Application Detection Engine
 * - OCR Validation Engine
 * - Multi Source Resolution Logic
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// APPLICATION TYPES
//////////////////////////////////////////////////////////////

export const ApplicationType = {
  CONVEYOR: "CONVEYOR",
  CRUSHER: "CRUSHER",
  PUMP: "PUMP",
  SCREW_JACK: "SCREW_JACK",
  MIXER: "MIXER",
  STACKER_RECLAIMER: "STACKER_RECLAIMER",
  HOIST: "HOIST",
  WINCH: "WINCH",
  TEST_BENCH: "TEST_BENCH",
  UNKNOWN: "UNKNOWN",
} as const;

export type ApplicationType = (typeof ApplicationType)[keyof typeof ApplicationType];

//////////////////////////////////////////////////////////////
// EXTRACTED PARAMETERS
//////////////////////////////////////////////////////////////

export interface ExtractedParameters {
  powerW?: number;

  powerHP?: number;

  inputRadS?: number;

  outputRadS?: number;

  torqueNm?: number;

  totalRatio?: number;

  axialLoadN?: number;

  linearVelocityMS?: number;

  screwPitchM?: number;

  strokeM?: number;

  ambientTemperatureK?: number;

  frequencyHz?: number;

  application?: ApplicationType;

  serviceFactor?: number;

  serviceFactorCondition?: 'less than' | 'greater than' | 'equal to' | 'minimum' | 'maximum' | null;

  raw_text: string;
}

//////////////////////////////////////////////////////////////
// REGEX EXTRACTION ENGINE
//////////////////////////////////////////////////////////////

export class ParameterExtractionEngine {
  static extract(text: string): ExtractedParameters {
    const result: ExtractedParameters = {
      raw_text: text,
    };

    //////////////////////////////////////////////////
    // POWER KW / WATTS / HP (With Alias Dictionary)
    //////////////////////////////////////////////////

    const powerPatterns = [
      /(?:Power|Motor\s+Power|Drive\s+Power|Motor\s+Rating|Motor\s+Capacity|Installed\s+Power|Connected\s+Load|Motor|\bPWR\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)(?!\d|\.\d)(?!\s*(?:RPM|r\/min|speed|poles?|hz|v|volts?))\s*(kW|HP|Kilowatt|Horsepower|h\.p\.)?/i,
      /(\d+(?:\.\d+)?)(?!\d|\.\d)\s*(?:kW|HP|Kilowatt|Horsepower|h\.p\.)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Power|Motor\s+Power|Drive\s+Power|Motor\s+Rating|Motor\s+Capacity|Installed\s+Power|Connected\s+Load|Motor|\bPWR\b)?/i
    ];

    let powerMatchedVal: number | null = null;
    let powerMatchedUnit: string | null = null;

    for (const p of powerPatterns) {
      const m = text.match(p);
      if (m) {
        powerMatchedVal = parseFloat(m[1]);
        powerMatchedUnit = m[2] ? m[2].toLowerCase() : null;
        if (!powerMatchedUnit) {
          // Check context around match for unit indicators
          const subText = text.slice(Math.max(0, m.index! - 15), Math.min(text.length, m.index! + m[0].length + 15)).toLowerCase();
          if (subText.includes('hp') || subText.includes('horsepower') || subText.includes('h.p.')) {
            powerMatchedUnit = 'hp';
          } else if (subText.includes('kw') || subText.includes('kilowatt')) {
            powerMatchedUnit = 'kw';
          } else if (subText.includes('w') || subText.includes('watts')) {
            powerMatchedUnit = 'w';
          }
        }
        break;
      }
    }

    if (powerMatchedVal !== null) {
      if (powerMatchedUnit === 'hp' || powerMatchedUnit === 'horsepower' || powerMatchedUnit === 'h.p.') {
        result.powerHP = powerMatchedVal;
      } else if (powerMatchedUnit === 'w' || powerMatchedUnit === 'watts') {
        result.powerW = powerMatchedVal;
      } else {
        result.powerW = powerMatchedVal * 1000; // Default to kW -> W
      }
    }

    // Fallbacks
    if (result.powerW === undefined) {
      const kwMatch = text.match(/(\d+\.?\d*)\s*kW/i);
      const wMatch = text.match(/(\d+\.?\d*)\s*(?:W|watts?)(?!\w)/i);
      if (kwMatch) {
        result.powerW = parseFloat(kwMatch[1]) * 1000;
      } else if (wMatch) {
        result.powerW = parseFloat(wMatch[1]);
      }
    }

    if (result.powerHP === undefined) {
      const hpMatch = text.match(/(\d+\.?\d*)\s*(HP|hp|h\.p\.)/i);
      if (hpMatch) {
        result.powerHP = parseFloat(hpMatch[1]);
      }
    }

    //////////////////////////////////////////////////
    // RPM (Input/Output distinction with Alias Mappings)
    //////////////////////////////////////////////////

    const inputRpmPatterns = [
      /(?:Motor\s+RPM|Motor\s+Speed|Drive\s+Motor\s+RPM|Drive\s+Speed|Input\s+Speed|Gearbox\s+Input\s+Speed|Motor\s+Nameplate\s+Speed|Rated\s+Motor\s+Speed|Motor\s+Output\s+Speed|Prime\s+Mover\s+Speed|Engine\s+RPM|Pump\s+RPM|Drive\s+Motor|\bINP\s+SPD\b|\bINP\.\s*SPD\b|\bINPUT\s+SPD\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:(?:\d+(?:\.\d+)?)\s*(?:kW|HP|kW\s+motor|HP\s+motor|Hz|pole|poles|V|volts?)[\s,;-]*)*?(\d+(?:\.\d+)?)(?!\d|\.\d)(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?/i,
      /(\d+(?:\.\d+)?)(?!\d|\.\d)(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Motor\s+RPM|Motor\s+Speed|Drive\s+Motor\s+RPM|Drive\s+Speed|Input\s+Speed|Gearbox\s+Input\s+Speed|Motor\s+Nameplate\s+Speed|Rated\s+Motor\s+Speed|Motor\s+Output\s+Speed|Prime\s+Mover\s+Speed|Engine\s+RPM|Pump\s+RPM|\bINP\s+SPD\b|\bINP\.\s*SPD\b|\bINPUT\s+SPD\b)/i
    ];

    let extractedInputRPM: number | null = null;

    for (const p of inputRpmPatterns) {
      const m = text.match(p);
      if (m) {
        let val = parseFloat(m[1]);
        const numIndex = m.index! + m[0].indexOf(m[1]) + m[1].length;
        const trailing = text.slice(numIndex, numIndex + 10).toLowerCase().trim();
        if (trailing.startsWith('rps')) {
          val = val * 60;
        }
        extractedInputRPM = val;
        break;
      }
    }

    const outputRpmPatterns = [
      /(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|Required\s+Output\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)(?!\d|\.\d)(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?/i,
      /(\d+(?:\.\d+)?)(?!\d|\.\d)(?!\s*(?:kW|HP|kw|hp|watts?|W\b|m\/s|m\/min|kN|N|ton|tons|t\b))\s*(RPM|r\/min|speed|RPS|rps)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:Output\s+Speed|Required\s+Speed|Gearbox\s+Output\s+Speed|Agitator\s+Speed|Drum\s+Speed|Conveyor\s+Speed|Mixer\s+Speed|Shaft\s+Speed|Table\s+Speed|Roll\s+Speed|Kiln\s+Speed|Mill\s+Speed|Bucket\s+Speed|Screw\s+Speed|\bOUT\s+SPD\b|\bOUT\.\s*SPD\b|\bOUTPUT\s+SPD\b)/i
    ];

    let extractedOutputRPM: number | null = null;

    for (const p of outputRpmPatterns) {
      const m = text.match(p);
      if (m) {
        let val = parseFloat(m[1]);
        const numIndex = m.index! + m[0].indexOf(m[1]) + m[1].length;
        const trailing = text.slice(numIndex, numIndex + 10).toLowerCase().trim();
        if (trailing.startsWith('rps')) {
          val = val * 60;
        }
        extractedOutputRPM = val;
        break;
      }
    }

    // Fallbacks
    if (!extractedOutputRPM) {
      const outRpmPatterns = [
        /output[^\r\n]*?(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)/i,
        /(?:drop\s+to|final|pulley|shaft|operating|drum|reduced)[^\S\r\n]+(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)/i,
        /(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)[^\S\r\n]*(?:output|pulley|operating|shaft|final|drum)/i,
        /speed\s+needs\s+to\s+drop\s+to\s+(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)/i
      ];

      for (const p of outRpmPatterns) {
        const m = text.match(p);
        if (m) {
          let val = parseFloat(m[1]);
          const numIndex = m.index! + m[0].indexOf(m[1]) + m[1].length;
          const trailing = text.slice(numIndex, numIndex + 10).toLowerCase().trim();
          if (trailing.startsWith('rps')) {
            val = val * 60;
          }
          extractedOutputRPM = val;
          break;
        }
      }
    }

    if (!extractedInputRPM) {
      const inRpmPatterns = [
        /input[^\r\n]*?(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)/i,
        /(?:motor|input|drive)[^\S\r\n]+(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)/i,
        /(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)[^\S\r\n]*(?:motor|input|drive)/i,
        /runs\s+at\s+(\d+(?:\.\d+)?)[^\S\r\n]*(rpm|rps)/i
      ];

      for (const p of inRpmPatterns) {
        const m = text.match(p);
        if (m) {
          let val = parseFloat(m[1]);
          const numIndex = m.index! + m[0].indexOf(m[1]) + m[1].length;
          const trailing = text.slice(numIndex, numIndex + 10).toLowerCase().trim();
          if (trailing.startsWith('rps')) {
            val = val * 60;
          }
          extractedInputRPM = val;
          break;
        }
      }
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
    const rpsRegex = /\b(\d+(?:\.\d+)?)\s*(?:RPS|rps)\b/gi;
    while ((match = rpsRegex.exec(text)) !== null) {
      const val = parseFloat(match[1]) * 60;
      if (!foundRpms.includes(val)) {
        foundRpms.push(val);
      }
    }

    if (foundRpms.length > 0) {
      // Sort in descending order: highest RPM first (likely input), lowest last (likely output)
      foundRpms.sort((a, b) => b - a);

      if (!extractedInputRPM && !extractedOutputRPM) {
        if (foundRpms.length >= 2) {
          extractedInputRPM = foundRpms[0];
          extractedOutputRPM = foundRpms[foundRpms.length - 1];
        } else {
          const val = foundRpms[0];
          if (val >= 500) {
            extractedInputRPM = val;
          } else {
            extractedOutputRPM = val;
          }
        }
      } else if (!extractedInputRPM) {
        const candidate = foundRpms.find(r => r !== extractedOutputRPM);
        if (candidate !== undefined) {
          extractedInputRPM = candidate;
        }
      } else if (!extractedOutputRPM) {
        const candidate = foundRpms.find(r => r !== extractedInputRPM);
        if (candidate !== undefined) {
          extractedOutputRPM = candidate;
        }
      }
    }

    if (extractedInputRPM) {
      result.inputRadS = extractedInputRPM * (2 * Math.PI) / 60;
    }
    if (extractedOutputRPM) {
      result.outputRadS = extractedOutputRPM * (2 * Math.PI) / 60;
    }

    //////////////////////////////////////////////////
    // TORQUE (Nm, kgf·m, lb·ft, lb·in with Aliases)
    //////////////////////////////////////////////////

    const torquePatterns = [
      /(?:\bTorque\b|Output\s+Torque|Input\s+Torque|Rated\s+Torque|Running\s+Torque|Load\s+Torque|Holding\s+Torque|Design\s+Torque|Peak\s+Torque|Breakout\s+Torque)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)\s*(?:N[·\-\.]?m|Newton[ \-]?meters?|kgf?[·\-\.]?m|kg[·\-\.]?m|lb[·\-\.]?ft|ft[·\-\.]?lbs?|lb[·\-\.]?in|in[·\-\.]?lbs?)?/i,
      /(\d+(?:\.\d+)?)\s*(?:N[·\-\.]?m|Newton[ \-]?meters?|kgf?[·\-\.]?m|kg[·\-\.]?m|lb[·\-\.]?ft|ft[·\-\.]?lbs?|lb[·\-\.]?in|in[·\-\.]?lbs?)\s*(?:is|of|was)?\s*[:=\s]*\s*(?:\bTorque\b|Output\s+Torque|Input\s+Torque|Rated\s+Torque|Running\s+Torque|Load\s+Torque|Holding\s+Torque|Design\s+Torque|Peak\s+Torque|Breakout\s+Torque)/i
    ];

    let torqueVal: number | null = null;
    let torqueUnit: string | null = null;

    for (const p of torquePatterns) {
      const m = text.match(p);
      if (m) {
        torqueVal = parseFloat(m[1]);
        torqueUnit = m[2] ? m[2].toLowerCase() : null;
        if (!torqueUnit) {
          const subText = text.slice(Math.max(0, m.index! - 15), Math.min(text.length, m.index! + m[0].length + 15)).toLowerCase();
          if (subText.includes('kgf') || subText.includes('kg·m') || subText.includes('kg-m') || subText.includes('kg.m')) {
            torqueUnit = 'kgf';
          } else if (subText.includes('ft') || subText.includes('lbs') || subText.includes('lb-ft')) {
            torqueUnit = 'ftlb';
          } else if (subText.includes('in') || subText.includes('in-lb')) {
            torqueUnit = 'inlb';
          }
        }
        break;
      }
    }

    if (torqueVal !== null) {
      if (torqueUnit === 'kgf') {
        result.torqueNm = torqueVal * 9.80665;
      } else if (torqueUnit === 'ftlb') {
        result.torqueNm = torqueVal * 1.35581794833;
      } else if (torqueUnit === 'inlb') {
        result.torqueNm = torqueVal * 0.112984829;
      } else {
        result.torqueNm = torqueVal;
      }
    }

    // Fallbacks
    if (result.torqueNm === undefined) {
      const torqueNmMatch = text.match(/(\d+\.?\d*)\s*(?:N[·\-\.]?m|Newton[ \-]?meters?)/i);
      const torqueKgfMatch = text.match(/(\d+\.?\d*)\s*(?:kgf?[·\-\.]?m|kg[·\-\.]?m)/i);
      const torqueFtLbMatch = text.match(/(\d+\.?\d*)\s*(?:lb[·\-\.]?ft|ft[·\-\.]?lbs?)/i);
      const torqueInLbMatch = text.match(/(\d+\.?\d*)\s*(?:lb[·\-\.]?in|in[·\-\.]?lbs?)/i);

      if (torqueNmMatch) {
        result.torqueNm = parseFloat(torqueNmMatch[1]);
      } else if (torqueKgfMatch) {
        result.torqueNm = parseFloat(torqueKgfMatch[1]) * 9.80665;
      } else if (torqueFtLbMatch) {
        result.torqueNm = parseFloat(torqueFtLbMatch[1]) * 1.35581794833;
      } else if (torqueInLbMatch) {
        result.torqueNm = parseFloat(torqueInLbMatch[1]) * 0.112984829;
      }
    }

    //////////////////////////////////////////////////
    // RATIO
    //////////////////////////////////////////////////

    const ratioPatterns = [
      /(?:\bRatio\b|\bReduction\s+Ratio\b|\bGear\s+Ratio\b|\bOverall\s+Ratio\b|\bReduction\b|\bReduction\s+Number\b|\bTransmission\s+Ratio\b|\bReduction\s+Factor\b|\bReduction\s+Rate\b|\bi\b)\s*(?:is|of|was)?\s*[:=\s]*\s*(\d+(?:\.\d+)?)\s*(?::\s*1)?/i,
      /(\d+(?:\.\d+)?)\s*(?::\s*1)?\s*(?:is|of|was)?\s*[:=\s]*\s*(?:\bRatio\b|\bReduction\s+Ratio\b|\bGear\s+Ratio\b|\bOverall\s+Ratio\b|\bReduction\b|\bReduction\s+Number\b|\bTransmission\s+Ratio\b|\bReduction\s+Factor\b|\bReduction\s+Rate\b|\bi\b)/i,
      /\b(\d+(?:\.\d+)?)\s*:\s*1\b/i
    ];

    for (const p of ratioPatterns) {
      const m = text.match(p);
      if (m) {
        result.totalRatio = parseFloat(m[1]);
        break;
      }
    }

    if (result.totalRatio === undefined) {
      const ratio = text.match(/ratio\s*[:=\s]\s*(\d+\.?\d*)/i) || text.match(/(\d+\.?\d*)\s*:\s*1/i);
      if (ratio) {
        result.totalRatio = parseFloat(ratio[1]);
      }
    }

    //////////////////////////////////////////////////
    // AXIAL LOAD (kN, N, kg, lbs)
    //////////////////////////////////////////////////

    const axialKn = text.match(/(\d+\.?\d*)\s*(?:kN|KN)/i);
    const axialN = text.match(/(\d+\.?\d*)\s*(?:N|Newtons?)(?!\w)/i);
    const axialKg = text.match(/(\d+\.?\d*)\s*(?:kgf|kg|kilograms?)/i);
    const axialLbs = text.match(/(\d+\.?\d*)\s*(?:lbf|lbs?|pounds?)/i);

    if (axialKn) {
      result.axialLoadN = parseFloat(axialKn[1]) * 1000;
    } else if (axialN) {
      result.axialLoadN = parseFloat(axialN[1]);
    } else if (axialKg) {
      result.axialLoadN = parseFloat(axialKg[1]) * 9.80665;
    } else if (axialLbs) {
      result.axialLoadN = parseFloat(axialLbs[1]) * 4.448221615;
    }

    //////////////////////////////////////////////////
    // LINEAR SPEED (mm/min, mm/s, m/s, m/min, in/min, in/s)
    //////////////////////////////////////////////////

    const speedMatch = text.match(/(\d+\.?\d*)\s*(mm\/min|mm\/s|m\/s|m\/min|in\/min|ipm|in\/s)/i);
    if (speedMatch) {
      const val = parseFloat(speedMatch[1]);
      const unit = speedMatch[2].toLowerCase();
      if (unit === 'mm/min') {
        result.linearVelocityMS = val / 60000;
      } else if (unit === 'mm/s') {
        result.linearVelocityMS = val / 1000;
      } else if (unit === 'm/s') {
        result.linearVelocityMS = val;
      } else if (unit === 'm/min') {
        result.linearVelocityMS = val / 60;
      } else if (unit === 'in/min' || unit === 'ipm') {
        result.linearVelocityMS = (val * 0.0254) / 60;
      } else if (unit === 'in/s') {
        result.linearVelocityMS = val * 0.0254;
      }
    }

    //////////////////////////////////////////////////
    // PITCH
    //////////////////////////////////////////////////

    const pitch = text.match(/pitch[:\s]*(\d+\.?\d*)\s*mm/i);

    if (pitch) {
      result.screwPitchM = parseFloat(pitch[1]) / 1000;
    }

    //////////////////////////////////////////////////
    // STROKE
    //////////////////////////////////////////////////

    const stroke = text.match(/stroke[:\s]*(\d+\.?\d*)\s*mm/i);

    if (stroke) {
      result.strokeM = parseFloat(stroke[1]) / 1000;
    }

    //////////////////////////////////////////////////
    // TEMPERATURE
    //////////////////////////////////////////////////

    const temp = text.match(/(\d+)\s*°?\s*C/i);

    if (temp) {
      result.ambientTemperatureK = parseFloat(temp[1]) + 273.15;
    }

    //////////////////////////////////////////////////
    // FREQUENCY
    //////////////////////////////////////////////////

    const hz = text.match(/(?:frequency|freq|Hz)\s*[:=\s]*\s*(50|60)/i) || text.match(/(50|60)\s*Hz/i);

    if (hz) {
      result.frequencyHz = parseFloat(hz[1]);
    }

    //////////////////////////////////////////////////
    // APPLICATION
    //////////////////////////////////////////////////

    const sfCondRegex = /(?:service\s+factor|SF|factor)\s*[:=\s]*\s*(?:is\s+|of\s+)?(less\s+than|greater\s+than|equal\s+to|minimum|maximum|min\b|max\b|<=|>=|<|>|=)\s*(?:is\s+|of\s+)?(\d+(?:\.\d+)?)/i;
    const sfCondMatch = text.match(sfCondRegex);

    if (sfCondMatch) {
      const condRaw = sfCondMatch[1].toLowerCase();
      let condition: 'less than' | 'greater than' | 'equal to' | 'minimum' | 'maximum' | null = null;
      if (condRaw === 'less than' || condRaw === '<' || condRaw === '<=') {
        condition = 'less than';
      } else if (condRaw === 'greater than' || condRaw === '>' || condRaw === '>=') {
        condition = 'greater than';
      } else if (condRaw === 'equal to' || condRaw === '=') {
        condition = 'equal to';
      } else if (condRaw === 'minimum' || condRaw === 'min') {
        condition = 'minimum';
      } else if (condRaw === 'maximum' || condRaw === 'max') {
        condition = 'maximum';
      }
      result.serviceFactorCondition = condition;
      result.serviceFactor = parseFloat(sfCondMatch[2]);
    } else {
      const sfSimpleRegex = /(?:service\s+factor|SF|factor)\s*[:=\s]*\s*(?:of|is\s+)?(\d+(?:\.\d+)?)/i;
      const sfSimpleMatch = text.match(sfSimpleRegex);
      if (sfSimpleMatch) {
        result.serviceFactor = parseFloat(sfSimpleMatch[1]);
        result.serviceFactorCondition = null;
      }
    }

    result.application = ApplicationDetectionEngine.detect(text);

    return result;
  }
}

//////////////////////////////////////////////////////////////
// APPLICATION DETECTION ENGINE
//////////////////////////////////////////////////////////////

export class ApplicationDetectionEngine {
  static detect(text: string): ApplicationType {
    const value = text.toLowerCase();

    if (
      value.includes("conveyor") ||
      value.includes("belt") ||
      value.includes("bucket elevator") ||
      value.includes("flight")
    ) {
      return ApplicationType.CONVEYOR;
    }

    if (
      value.includes("crusher") ||
      value.includes("jaw") ||
      value.includes("cone") ||
      value.includes("mill") ||
      value.includes("grinder")
    ) {
      return ApplicationType.CRUSHER;
    }

    if (
      value.includes("pump") ||
      value.includes("centrifugal") ||
      value.includes("submersible")
    ) {
      return ApplicationType.PUMP;
    }

    if (
      value.includes("screw jack") ||
      value.includes("linear actuator") ||
      value.includes("lift")
    ) {
      return ApplicationType.SCREW_JACK;
    }

    if (
      value.includes("agitator") ||
      value.includes("mixer") ||
      value.includes("ribbon")
    ) {
      return ApplicationType.MIXER;
    }

    if (
      value.includes("stacker") ||
      value.includes("reclaimer") ||
      value.includes("slew")
    ) {
      return ApplicationType.STACKER_RECLAIMER;
    }

    if (
      value.includes("winch")
    ) {
      return ApplicationType.WINCH;
    }

    if (
      value.includes("hoist") ||
      value.includes("crane")
    ) {
      return ApplicationType.HOIST;
    }

    if (value.includes("test bench") || value.includes("dynamometer")) {
      return ApplicationType.TEST_BENCH;
    }

    return ApplicationType.UNKNOWN;
  }
}

//////////////////////////////////////////////////////////////
// OCR VALIDATION ENGINE
//////////////////////////////////////////////////////////////

export class OCRValidationEngine {
  static validate(params: ExtractedParameters): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    if (
      params.inputRadS &&
      (params.inputRadS < 100 * 2 * Math.PI / 60 || params.inputRadS > 10000 * 2 * Math.PI / 60)
    ) {
      flags.push({
        severity: "WARNING",
        parameter: "RPM",
        message: "RPM outside expected range",
        action: "Check OCR interpretation",
      });
    }

    if (params.powerW && (params.powerW < 100 || params.powerW > 10000000)) {
      flags.push({
        severity: "WARNING",
        parameter: "Power",
        message: "Power outside valid range",
        action: "Verify OCR result",
      });
    }

    if (params.totalRatio && (params.totalRatio < 1 || params.totalRatio > 2000)) {
      flags.push({
        severity: "WARNING",
        parameter: "Ratio",
        message: "Ratio outside planetary range",
        action: "Verify extracted value",
      });
    }

    return flags;
  }
}

//////////////////////////////////////////////////////////////
// MULTI SOURCE RESOLUTION ENGINE
//////////////////////////////////////////////////////////////

export interface SourceValue<T> {
  value: T;

  source: "nameplate" | "datasheet" | "email" | "calculated" | "default";
}

export class MultiSourceResolutionEngine {
  static resolve<T>(values: SourceValue<T>[]): T {
    const priority = {
      nameplate: 1,

      datasheet: 2,

      email: 3,

      calculated: 4,

      default: 5,
    };

    values.sort((a, b) => priority[a.source] - priority[b.source]);

    return values[0].value;
  }
}

//////////////////////////////////////////////////////////////
// MISSING DATA RESOLUTION ENGINE
//////////////////////////////////////////////////////////////

export class MissingDataResolutionEngine {
  static resolveInputRadS(input: GearboxInput): number | undefined {
    // 1. Direct input found, do not perform calculations
    if (input.inputRadS) {
      return input.inputRadS;
    }

    let calculated: number | undefined = undefined;

    // 2. Reverse from output speed and ratio
    if (input.outputRadS && input.totalRatio) {
      calculated = input.outputRadS * input.totalRatio;
    }
    // 3. Reverse from power and torque
    else if (input.powerW && input.inputTorqueNm) {
      calculated = input.powerW / input.inputTorqueNm;
    }
    // 4. Derive from poles
    else if (input.motorPoles && input.frequencyHz) {
      calculated = MotorSpeedEngine.actualSpeed(input.motorPoles, input.frequencyHz);
    }

    if (calculated !== undefined) {
      const snapResult = MotorSpeedEngine.snapToStandardSpeed(calculated);
      return snapResult.snapped;
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolvePower(input: GearboxInput): number | undefined {
    // 1. Direct input found, do not perform calculations
    if (input.powerW) {
      return input.powerW;
    }

    if (input.powerHP) {
      return input.powerHP * 745.7;
    }

    // 2. Chained resolution
    const rads = MissingDataResolutionEngine.resolveInputRadS(input);
    const torque = MissingDataResolutionEngine.resolveTorque(input);
    if (torque && rads) {
      return torque * rads;
    }

    if (input.outputTorqueNm && input.outputRadS) {
      return input.outputTorqueNm * input.outputRadS;
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveTorque(input: GearboxInput): number | undefined {
    // 1. Direct input found, do not perform calculations
    if (input.inputTorqueNm) {
      return input.inputTorqueNm;
    }

    // 2. Chained resolution
    const powerW = input.powerW || (input.powerHP ? input.powerHP * 745.7 : undefined);
    const inputRadS = MissingDataResolutionEngine.resolveInputRadS(input);

    if (powerW && inputRadS) {
      return powerW / inputRadS;
    }

    if (input.axialLoadN && input.screwPitchM) {
      return (
        (input.axialLoadN * input.screwPitchM) /
        (2 * Math.PI * 0.4)
      );
    }

    if (input.outputTorqueNm && input.totalRatio) {
      const stageCount = StageCountEngine.determineStageCount(input.totalRatio);
      const efficiency = input.efficiency !== undefined ? input.efficiency : Math.pow(0.97, stageCount);
      return input.outputTorqueNm / (input.totalRatio * efficiency);
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveRatio(input: GearboxInput): number | undefined {
    // 1. Direct input found, do not perform calculations
    if (input.totalRatio) {
      return input.totalRatio;
    }

    // 2. Chained resolution
    const inputRadS = MissingDataResolutionEngine.resolveInputRadS(input);
    const outputRadS = MissingDataResolutionEngine.resolveOutputRadS(input);
    if (inputRadS && outputRadS) {
      return inputRadS / outputRadS;
    }

    if (input.outputTorqueNm && input.inputTorqueNm) {
      const ratioGuess = input.outputTorqueNm / input.inputTorqueNm;
      const stageCount = StageCountEngine.determineStageCount(ratioGuess);
      const eff = input.efficiency !== undefined ? input.efficiency : Math.pow(0.97, stageCount);
      return input.outputTorqueNm / (input.inputTorqueNm * eff);
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveOutputRadS(input: GearboxInput): number | undefined {
    // 1. Direct input found, do not perform calculations
    if (input.outputRadS) {
      return input.outputRadS;
    }

    // 2. Chained resolution
    const inputRadS = MissingDataResolutionEngine.resolveInputRadS(input);
    if (inputRadS && input.totalRatio) {
      return inputRadS / input.totalRatio;
    }

    if (input.linearVelocityMS && input.screwPitchM) {
      return (input.linearVelocityMS * 2 * Math.PI) / input.screwPitchM;
    }

    const powerW = input.powerW || (input.powerHP ? input.powerHP * 745.7 : undefined);
    if (powerW && input.outputTorqueNm) {
      return powerW / input.outputTorqueNm;
    }

    return undefined;
  }

  //////////////////////////////////////////////////

  static resolveServiceFactor(input: GearboxInput): number {
    // 1. Direct input found, do not perform calculations
    if (input.serviceFactor) {
      return input.serviceFactor;
    }

    return ServiceFactorEngine.calculate(
      input.applicationType,
      input.dutyHoursPerDay,
      input.startsPerHour,
    );
  }
}

//////////////////////////////////////////////////////////////
// EXTRACTION TEST
//////////////////////////////////////////////////////////////

const sample = `
15 kW motor
1440 RPM
ratio 72
belt conveyor
`;

const extracted = ParameterExtractionEngine.extract(sample);

console.log(extracted);

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 4
 *
 * Sections Implemented:
 * - Gearbox Selection Engine
 * - Candidate Ranking Engine
 * - Confidence Scoring Engine
 * - Audit Trail Engine
 * - Engineering Decision Logic
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// GEARBOX DATABASE MODEL
//////////////////////////////////////////////////////////////

import { gearboxDatabase } from "../data/gearboxDatabase";

export interface GearboxDatabaseRecord {
  model_id: string;

  nominal_torque: number;

  max_torque: number;

  ratio: number;

  max_input_rpm: number;
}

//////////////////////////////////////////////////////////////
// GEARBOX SELECTION ENGINE
//////////////////////////////////////////////////////////////

export class GearboxSelectionEngine {
  static selectCandidates(
    requiredNominal: number,
    requiredMaximum: number,
    targetRatio: number,
    motorRPM: number,
    input?: GearboxInput,
  ): GearboxCandidate[] {
    const candidates: GearboxCandidate[] = [];

    // Determine the required stage count for the target ratio
    const stageCount = StageCountEngine.determineStageCount(targetRatio);

    // Filter actual MAGTORQ gearbox database by series matching stage count
    const filtered = gearboxDatabase.filter((g) => g.series === stageCount);

    for (const gb of filtered) {
      // Check nominal torque and rated torque capacities
      const nominalCheck = gb.nominal >= requiredNominal;

      const maxCheck = gb.rated >= requiredMaximum;

      // Speed check: standard MAGTORQ input speed limit is 3000 RPM (3000 * 2pi / 60 rad/s)
      const maxInputRadS = 3000 * 2 * Math.PI / 60;

      const speedCheck = maxInputRadS >= motorRPM;

      // Thermal rating check
      let thermalSafe = true;
      if (input && input.powerW && gb.thermal_capacity_kw !== undefined) {
        const thermalCheck = ThermalRatingEngine.verifyThermalLimit(
          input.powerW / 1000,
          gb.thermal_capacity_kw,
          input.ambientTemperatureK !== undefined ? input.ambientTemperatureK - 273.15 : undefined,
        );
        thermalSafe = thermalCheck.isSafe;
      }

      // Mounting check
      let mountingAllowed = true;
      if (input && input.mountingPosition) {
        const mountingCheck = MountingPositionEngine.verifyMounting(
          input.mountingPosition,
          input.axialThrustLoadN,
          gb.thrust_load_rating_kn !== undefined ? gb.thrust_load_rating_kn * 1000 : undefined,
        );
        mountingAllowed = mountingCheck.isAllowed;
      }

      if (nominalCheck && maxCheck && speedCheck && thermalSafe && mountingAllowed) {
        const sf = SafetyFactorEngine.calculate(
          gb.nominal,
          gb.rated,
          requiredNominal,
          requiredMaximum,
        );

        // Derive confidence level to pass down
        let confidenceLevel: ConfidenceLevel = "HIGH";
        if (input) {
          const hasPower = !!input.powerW || !!input.powerHP;
          const hasInputRpm = !!input.inputRadS || (!!input.motorPoles && !!input.frequencyHz);
          const hasServiceFactor = !!input.serviceFactor;
          const hasRatio = !!input.totalRatio;
          const hasEfficiency = !!input.efficiency;

          let assumptions = 0;
          if (!hasPower) assumptions++;
          if (!hasInputRpm) assumptions++;
          if (!hasServiceFactor) assumptions++;
          if (!hasRatio) assumptions++;
          if (!hasEfficiency) assumptions++;

          if (assumptions === 1) confidenceLevel = "MEDIUM";
          else if (assumptions >= 2) confidenceLevel = "LOW";
        }

        candidates.push({
          model_id: gb.size,

          nominal_torque: gb.nominal,

          max_torque: gb.rated,

          actual_ratio: targetRatio,

          max_input_rpm: 3000,

          safety_factor: sf,

          recommendation: CandidateRankingEngine.recommendation(sf, confidenceLevel),
        });
      }
    }

    return candidates;
  }
}

//////////////////////////////////////////////////////////////
// CANDIDATE RANKING ENGINE
//////////////////////////////////////////////////////////////

export class CandidateRankingEngine {
  static recommendation(
    sf: number,
    confidenceLevel?: ConfidenceLevel
  ): Recommendation {
    if (sf < 1.0) return "REJECT";

    if (sf < 1.1) return "MARGINAL";

    const base = sf <= 1.5 ? "PREFERRED" : "ACCEPTABLE";

    if (confidenceLevel === "LOW") {
      return "ENGINEERING_REVIEW_REQUIRED";
    }

    if (confidenceLevel === "MEDIUM" && base === "PREFERRED") {
      return "PREFERRED_WITH_WARNING";
    }

    return base;
  }

  static rank(candidates: GearboxCandidate[], input?: GearboxInput): GearboxCandidate[] {
    return candidates.sort((a, b) => {
      const getWeightedScore = (c: GearboxCandidate) => {
        const D_safety = Math.abs(c.safety_factor - 1.3);

        let D_thermal = 0.5;
        let D_ratio = 0.0;

        const gb = gearboxDatabase.find(g => g.size === c.model_id);
        if (gb) {
          if (input && input.powerW && gb.thermal_capacity_kw) {
            const f_ambient = ThermalRatingEngine.calculateAmbientFactor(input.ambientTemperatureK !== undefined ? input.ambientTemperatureK - 273.15 : undefined);
            const capacity = gb.thermal_capacity_kw * f_ambient;
            D_thermal = Math.abs(1.0 - ((input.powerW / 1000) / capacity));
          }
          if (input && input.totalRatio) {
            D_ratio = Math.abs(c.actual_ratio - input.totalRatio) / input.totalRatio;
          }
        }

        return 0.50 * D_safety + 0.30 * D_thermal + 0.20 * D_ratio;
      };

      return getWeightedScore(a) - getWeightedScore(b);
    });
  }
}

//////////////////////////////////////////////////////////////
// CONFIDENCE SCORING ENGINE
//////////////////////////////////////////////////////////////

export class ConfidenceScoringEngine {
  static calculate(options: {
    powerDerived?: boolean;
    rpmDerived?: boolean;
    serviceFactorDerived?: boolean;
    ratioCalculated?: boolean;
    applicationInferred?: boolean;
    multipleMissing?: boolean;
    noValidationData?: boolean;
    assumptionsCount?: number;
  }): number {
    if (options.assumptionsCount !== undefined) {
      if (options.assumptionsCount === 0) return 1.0;
      if (options.assumptionsCount === 1) return 0.7;
      return 0.4;
    }

    let assumptions = 0;
    if (options.powerDerived) assumptions++;
    if (options.rpmDerived) assumptions++;
    if (options.serviceFactorDerived) assumptions++;
    if (options.ratioCalculated) assumptions++;

    if (assumptions === 0) return 1.0;
    if (assumptions === 1) return 0.7;
    return 0.4;
  }

  static confidenceLevel(score: number): "HIGH" | "MEDIUM" | "LOW" {
    if (score >= 0.9) return "HIGH";
    if (score >= 0.6) return "MEDIUM";
    return "LOW";
  }

  static requiresEngineerReview(score: number): boolean {
    return score < 0.6;
  }
}

//////////////////////////////////////////////////////////////
// AUDIT TRAIL ENGINE
//////////////////////////////////////////////////////////////

export class AuditTrailEngine {
  static createAuditTrail(
    inputRaw: GearboxInput,
    inputResolved: GearboxInput,
    derivations: DerivationEntry[],
    calculations: CalculationResult,
    candidates: GearboxCandidate[],
    recommendation: GearboxCandidate,
    flags: ValidationFlag[],
    confidenceScore: number,
  ): AuditTrail {
    return {
      session_id: crypto.randomUUID(),

      timestamp: new Date().toISOString(),

      input_raw: inputRaw,

      input_resolved: inputResolved,

      derivations,

      calculations,

      candidates,

      recommendation,

      flags,

      engineer_review_required:
        ConfidenceScoringEngine.requiresEngineerReview(confidenceScore),

      confidence_score: confidenceScore,
    };
  }
}

//////////////////////////////////////////////////////////////
// DECISION ENGINE
//////////////////////////////////////////////////////////////

export class DecisionEngine {
  static evaluate(candidate: GearboxCandidate): string {
    if (candidate.safety_factor < 1) {
      return "REJECTED";
    }

    if (candidate.safety_factor < 1.1) {
      return "MARGINAL";
    }

    if (candidate.safety_factor < 1.25) {
      return "ACCEPTABLE";
    }

    if (candidate.safety_factor < 1.5) {
      return "GOOD";
    }

    if (candidate.safety_factor < 2.0) {
      return "CONSERVATIVE";
    }

    return "OVER_DESIGNED";
  }
}

//////////////////////////////////////////////////////////////
// ENGINEERING VALIDATION RULES
//////////////////////////////////////////////////////////////

export class EngineeringValidationEngine {
  static validateSelection(
    candidate: GearboxCandidate,
    requiredNominal: number,
    requiredMaximum: number,
    targetRatio: number,
    motorRPM: number,
  ): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    if (candidate.nominal_torque < requiredNominal) {
      flags.push({
        severity: "ERROR",
        parameter: "Nominal Torque",
        message: "Nominal torque insufficient",
        action: "Select larger gearbox",
      });
    }

    if (candidate.max_torque < requiredMaximum) {
      flags.push({
        severity: "ERROR",
        parameter: "Maximum Torque",
        message: "Maximum torque insufficient",
        action: "Increase gearbox size",
      });
    }

    const ratioError =
      Math.abs(candidate.actual_ratio - targetRatio) / targetRatio;

    if (ratioError > 0.03) {
      flags.push({
        severity: "WARNING",
        parameter: "Ratio",
        message: "Ratio outside ±3%",
        action: "Review stage selection",
      });
    }

    if (candidate.max_input_rpm < motorRPM) {
      flags.push({
        severity: "ERROR",
        parameter: "RPM",
        message: "Input RPM exceeds gearbox limit",
        action: "Select higher speed gearbox",
      });
    }

    return flags;
  }
}

//////////////////////////////////////////////////////////////
// TEST CASE
//////////////////////////////////////////////////////////////

const confidence = ConfidenceScoringEngine.calculate({
  powerDerived: false,

  rpmDerived: true,

  serviceFactorDerived: true,

  ratioCalculated: true,

  applicationInferred: false,

  multipleMissing: false,

  noValidationData: false,
});

console.log("Confidence Score:", confidence);

console.log(
  "Confidence Level:",
  ConfidenceScoringEngine.confidenceLevel(confidence),
);

const candidates = GearboxSelectionEngine.selectCandidates(
  14042,
  21063,
  88.5,
  1440,
);

console.log("Candidates:", candidates);

console.log("Ranked:", CandidateRankingEngine.rank(candidates));

/***********************************************************************
 * MAGTORQ GEARBOX SELECTOR
 * PART 5
 *
 * Sections Implemented:
 * - Report Generator
 * - Workflow Pipeline
 * - Candidate Evaluation
 * - Audit Generation
 * - End-to-End Execution
 * - runGearboxSelector()
 ***********************************************************************/

//////////////////////////////////////////////////////////////
// REPORT INTERFACES
//////////////////////////////////////////////////////////////

export interface EngineeringReport {
  summary: {
    application: string;

    selected_gearbox: string;

    safety_factor: number;

    confidence: string;
  };

  input_parameters: GearboxInput;

  calculations: CalculationResult;

  stage_analysis: {
    stage_count: number;
    stage_ratios: number[];
    stage_torques: number[];
    stage_speeds: number[];
    efficiency: number;
  };

  gearbox_options: GearboxCandidate[];

  warnings: ValidationFlag[];

  audit: AuditTrail;
}

//////////////////////////////////////////////////////////////
// REPORT GENERATOR
//////////////////////////////////////////////////////////////

export class ReportGenerator {
  static generate(
    application: string,
    candidate: GearboxCandidate,
    calculations: CalculationResult,
    audit: AuditTrail,
    warnings: ValidationFlag[],
  ): EngineeringReport {
    return {
      summary: {
        application,

        selected_gearbox: candidate.model_id,

        safety_factor: candidate.safety_factor,

        confidence: calculations.confidence,
      },

      input_parameters: audit.input_resolved,

      calculations,

      stage_analysis: {
        stage_count: calculations.stage_count,

        stage_ratios: calculations.stage_ratios,

        stage_torques: calculations.stage_torques,

        stage_speeds: calculations.stage_speeds,

        efficiency: calculations.overall_efficiency,
      },

      gearbox_options: audit.candidates,

      warnings,

      audit,
    };
  }
}

//////////////////////////////////////////////////////////////
// CALCULATION PIPELINE
//////////////////////////////////////////////////////////////

export class GearboxCalculationPipeline {
  static execute(input: GearboxInput): CalculationResult {
    const hasPower = !!input.powerW || !!input.powerHP;
    const hasInputRpm = !!input.inputRadS || (!!input.motorPoles && !!input.frequencyHz);
    const hasServiceFactor = !!input.serviceFactor;
    const hasRatio = !!input.totalRatio;
    const hasEfficiency = !!input.efficiency;

    let assumptionsCount = 0;
    if (!hasPower) assumptionsCount++;
    if (!hasInputRpm) assumptionsCount++;
    if (!hasServiceFactor) assumptionsCount++;
    if (!hasRatio) assumptionsCount++;
    if (!hasEfficiency) assumptionsCount++;

    //////////////////////////////////////////////////////
    // RESOLVE DATA
    //////////////////////////////////////////////////////

    const power = MissingDataResolutionEngine.resolvePower(input);
    if (power && !input.powerW) {
      input.powerW = power;
    }

    const inputRadS = MissingDataResolutionEngine.resolveInputRadS(input);
    if (inputRadS && !input.inputRadS) {
      input.inputRadS = inputRadS;
    }

    const outputRadS = MissingDataResolutionEngine.resolveOutputRadS(input);
    if (outputRadS && !input.outputRadS) {
      input.outputRadS = outputRadS;
    }

    const torque = MissingDataResolutionEngine.resolveTorque(input);
    if (torque) {
      const isScrewJack = input.applicationType?.toUpperCase().replace("_", " ") === "SCREW JACK";
      if (isScrewJack) {
        if (!input.outputTorqueNm) {
          input.outputTorqueNm = torque;
        }
      } else {
        if (!input.inputTorqueNm) {
          input.inputTorqueNm = torque;
        }
      }
    }

    const ratio = MissingDataResolutionEngine.resolveRatio(input)!;
    if (ratio && !input.totalRatio) {
      input.totalRatio = ratio;
    }

    const serviceFactor =
      MissingDataResolutionEngine.resolveServiceFactor(input);
    if (serviceFactor && !input.serviceFactor) {
      input.serviceFactor = serviceFactor;
    }

    //////////////////////////////////////////////////////
    // STAGE COUNT
    //////////////////////////////////////////////////////

    const stageCount = StageCountEngine.determineStageCount(ratio);

    //////////////////////////////////////////////////////
    // DISTRIBUTE RATIOS
    //////////////////////////////////////////////////////

    const stageRatios = StageDistributionEngine.distributeRatio(
      ratio,
      stageCount,
    );

    //////////////////////////////////////////////////////
    // INPUT/OUTPUT TORQUE RESOLUTION
    //////////////////////////////////////////////////////

    let inputTorque: number;
    if (input.inputTorqueNm) {
      inputTorque = input.inputTorqueNm;
    } else if (input.outputTorqueNm && ratio) {
      const efficiency = input.efficiency !== undefined ? input.efficiency : Math.pow(0.97, stageCount);
      inputTorque = input.outputTorqueNm / (ratio * efficiency);
    } else {
      inputTorque =
        torque ?? PowerTorqueEngine.calcTorque(power!, input.inputRadS!);
    }

    //////////////////////////////////////////////////////
    // TORQUE PROPAGATION
    //////////////////////////////////////////////////////

    const stageTorques = TorquePropagationEngine.propagateTorques(
      inputTorque,
      stageRatios,
      input.efficiency !== undefined ? Math.pow(input.efficiency, 1 / stageCount) : 0.97,
    );

    //////////////////////////////////////////////////////
    // SPEED PROPAGATION
    //////////////////////////////////////////////////////

    const stageSpeeds = TorquePropagationEngine.propagateSpeeds(
      input.inputRadS!,
      stageRatios,
    );

    //////////////////////////////////////////////////////
    // OUTPUT TORQUE
    //////////////////////////////////////////////////////

    const outputTorque = stageTorques[stageTorques.length - 1];

    //////////////////////////////////////////////////////
    // PEAK FACTOR
    //////////////////////////////////////////////////////

    const peakFactor = PeakFactorEngine.getPeakFactor(input.applicationType);

    //////////////////////////////////////////////////////
    // REQUIRED TORQUES
    //////////////////////////////////////////////////////

    const requiredNominal = RequiredTorqueEngine.requiredNominal(
      outputTorque,
      serviceFactor,
    );

    const requiredMaximum = RequiredTorqueEngine.requiredMaximum(
      outputTorque,
      serviceFactor,
      peakFactor,
    );

    //////////////////////////////////////////////////////
    // CONFIDENCE
    //////////////////////////////////////////////////////

    const confidenceScore = ConfidenceScoringEngine.calculate({
      assumptionsCount,
    });

    return {
      input_torque_nm: inputTorque,

      output_torque_nm: outputTorque,

      total_ratio: ratio,

      stage_count: stageCount,

      stage_ratios: stageRatios,

      stage_torques: stageTorques,

      stage_speeds: stageSpeeds,

      service_factor: serviceFactor,

      required_nominal_nm: requiredNominal,

      required_maximum_nm: requiredMaximum,

      overall_efficiency: input.efficiency !== undefined ? input.efficiency : TorquePropagationEngine.overallEfficiency(stageCount),

      derivation_log: [],

      flags: [],

      confidence: ConfidenceScoringEngine.confidenceLevel(confidenceScore),
    };
  }
}

//////////////////////////////////////////////////////////////
// COMPLETE SELECTOR ENGINE
//////////////////////////////////////////////////////////////

export class GearboxSelectorEngine {
  static run(input: GearboxInput): EngineeringReport {
    const hasPower = !!input.powerW || !!input.powerHP;
    const hasInputRpm = !!input.inputRadS || (!!input.motorPoles && !!input.frequencyHz);
    const hasServiceFactor = !!input.serviceFactor;
    const hasRatio = !!input.totalRatio;
    const hasEfficiency = !!input.efficiency;

    let assumptionsCount = 0;
    if (!hasPower) assumptionsCount++;
    if (!hasInputRpm) assumptionsCount++;
    if (!hasServiceFactor) assumptionsCount++;
    if (!hasRatio) assumptionsCount++;
    if (!hasEfficiency) assumptionsCount++;

    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    const validationFlags = ValidationEngine.validateInput(input);

    //////////////////////////////////////////////////////
    // CALCULATIONS
    //////////////////////////////////////////////////////

    const calculations = GearboxCalculationPipeline.execute(input);

    //////////////////////////////////////////////////////
    // GEARBOX SEARCH
    //////////////////////////////////////////////////////

    const candidates = GearboxSelectionEngine.selectCandidates(
      calculations.required_nominal_nm,

      calculations.required_maximum_nm,

      calculations.total_ratio,

      input.inputRadS!,
      input,
    );

    //////////////////////////////////////////////////////
    // RANK
    //////////////////////////////////////////////////////

    const ranked = CandidateRankingEngine.rank(candidates, input);

    if (ranked.length === 0) {
      throw new Error("No gearbox satisfies requirements.");
    }

    //////////////////////////////////////////////////////
    // BEST CANDIDATE
    //////////////////////////////////////////////////////

    const best = ranked[0];

    //////////////////////////////////////////////////////
    // CONFIDENCE
    //////////////////////////////////////////////////////

    const confidence = ConfidenceScoringEngine.calculate({
      assumptionsCount,
    });

    //////////////////////////////////////////////////////
    // AUDIT
    //////////////////////////////////////////////////////

    const audit = AuditTrailEngine.createAuditTrail(
      input,

      input,

      [],

      calculations,

      ranked,

      best,

      validationFlags,

      confidence,
    );

    //////////////////////////////////////////////////////
    // REPORT
    //////////////////////////////////////////////////////

    return ReportGenerator.generate(
      input.applicationType,

      best,

      calculations,

      audit,

      validationFlags,
    );
  }
}

//////////////////////////////////////////////////////////////
// MASTER FUNCTION
//////////////////////////////////////////////////////////////

export function runGearboxSelector(input: GearboxInput): EngineeringReport {
  return GearboxSelectorEngine.run(input);
}

try {
  const conveyorExample = runGearboxSelector({
    applicationType: "belt conveyor",

    loadType: "variable",

    powerW: 15000,

    inputRadS: 1440 * 2 * Math.PI / 60,

    outputRadS: 20 * 2 * Math.PI / 60,

    dutyHoursPerDay: 12,

    startsPerHour: 4,
  });

  console.log("Conveyor Example Selected Gearbox:", conveyorExample.summary.selected_gearbox);
} catch (e) {
  console.error("Conveyor Example failed:", e);
}

try {
  const screwJackExample = runGearboxSelector({
    applicationType: "screw jack",

    loadType: "uniform",

    axialLoadN: 35500,

    screwPitchM: 0.006,

    inputRadS: 910 * 2 * Math.PI / 60,

    linearVelocityMS: 0.005,

    dutyHoursPerDay: 8,

    startsPerHour: 2,
  });

  console.log("Screw Jack Example Selected Gearbox:", screwJackExample.summary.selected_gearbox);
} catch (e) {
  console.error("Screw Jack Example failed:", e);
}

