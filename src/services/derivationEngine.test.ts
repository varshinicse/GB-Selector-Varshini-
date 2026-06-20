import { describe, it, expect } from 'vitest';
import { MissingParameterResolutionEngine, parseInputsFromText, parseInputsWithMetadata, derivationRules } from './derivationEngine';
import { generateAuditReport } from './engineeringReasoningEngine';
import { verifyEngineeringReport } from './verificationEngine';

describe('Phase 1 Derivation Rules Formula Accuracy', () => {
  it('should verify DR-001: Conveyor Belt Speed to Output RadS', () => {
    const rule = derivationRules.find(r => r.id === 'DR-001')!;
    const res = rule.formula({ beltSpeed_m_s: 2.5, pulleyDiameter_m: 0.8 });
    // w = 2 * 2.5 / 0.8 = 6.25 rad/s
    expect(res).toBeCloseTo(6.25, 3);
  });

  it('should verify DR-002: Chain Conveyor Speed to Output RadS', () => {
    const rule = derivationRules.find(r => r.id === 'DR-002')!;
    const res = rule.formula({ chainSpeed_m_s: 0.5, sprocketPCD_m: 0.4 });
    // w = 2 * 0.5 / 0.4 = 2.5 rad/s
    expect(res).toBeCloseTo(2.5, 3);
  });

  it('should verify DR-005: Belt Pull to Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-005')!;
    const res = rule.formula({ beltPull_N: 12000, pulleyDiameter_m: 0.8 });
    // T = (12000 * 0.8) / 2 = 4800 Nm
    expect(res).toBe(4800);
  });

  it('should verify DR-006: Hoist Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-006')!;
    const res = rule.formula({ hoistLoad_N: 25000, drumDiameter_m: 0.6, reevingFalls: 2 });
    // T = (25000 * 0.6) / (2 * 2) = 15000 / 4 = 3750 Nm
    expect(res).toBe(3750);
  });

  it('should verify DR-008: Fan Power', () => {
    const rule = derivationRules.find(r => r.id === 'DR-008')!;
    const res = rule.formula({ airflow_m3_s: 8.5, staticPressure_Pa: 1200, fanEfficiency: 0.75 });
    // P = (8.5 * 1200) / 0.75 = 10200 / 0.75 = 13600 W
    expect(res).toBeCloseTo(13600, 2);
  });

  it('should verify DR-009: Pump Power', () => {
    const rule = derivationRules.find(r => r.id === 'DR-009')!;
    const res = rule.formula({
      flowRate_m3_s: 0.05,
      pumpHead_m: 45,
      pumpEfficiency: 0.70,
      liquidDensity_kg_m3: 1000
    });
    // P = (1000 * 9.80665 * 0.05 * 45) / 0.7 = 22064.96 / 0.7 = 31521.375 W
    expect(res).toBeCloseTo(31521.375, 3);
  });

  it('should verify DR-010: Acceleration Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-010')!;
    const res = rule.formula({ systemInertia_kg_m2: 5.2, deltaSpeed_RadS: 1440 * 2 * Math.PI / 60, accelTime_s: 3.5 });
    // alpha = (1440 * 2pi) / (60 * 3.5) = 43.085 rad/s2
    // T = 5.2 * 43.085 = 224.043 Nm
    expect(res).toBeCloseTo(224.04, 2);
  });

  it('should verify DR-011: RMS Torque from Load Steps', () => {
    const rule = derivationRules.find(r => r.id === 'DR-011')!;
    const res = rule.formula({
      loadTorques_Nm: [100, 200, 150],
      loadDurations_s: [10, 20, 15]
    });
    // weightedSum = 100^2 * 10 + 200^2 * 20 + 150^2 * 15 = 1,237,500
    // totalTime = 45
    // RMS = sqrt(1,237,500 / 45) = 165.83
    expect(res).toBeCloseTo(165.83, 2);
  });

  it('should verify DR-013: Thermal Duty Cycle Power', () => {
    const rule = derivationRules.find(r => r.id === 'DR-013')!;
    const res = rule.formula({ designPower_W: 45000, onTime_min: 15, offTime_min: 45 });
    // P_eff = 45000 * sqrt(15 / 60) = 22500 W
    expect(res).toBe(22500);
  });

  it('should verify DR-014: Service Life Hours', () => {
    const rule = derivationRules.find(r => r.id === 'DR-014')!;
    const res = rule.formula({ serviceYears: 10, hoursPerDay: 16, availabilityFactor: 0.95 });
    // Life = 10 * 365 * 16 * 0.95 = 55480 hours
    expect(res).toBe(55480);
  });

  it('should verify DR-015: Efficiency Corrected Torque', () => {
    const rule = derivationRules.find(r => r.id === 'DR-015')!;
    const res = rule.formula({ powerW: 15000, efficiency: 0.94, outputRadS: 20 * 2 * Math.PI / 60 });
    // T = (15000 * 0.94) / (20 * 2 * pi / 60) = 14100 / 2.094395 = 6732.2565 Nm
    expect(res).toBeCloseTo(6732.25, 2);
  });
});

describe('Topological Dependency Resolution Engine', () => {
  it('should recursively resolve downstream parameters', () => {
    const known = {
      beltSpeed_m_s: 2.5,
      pulleyDiameter_m: 0.8,
      beltPull_N: 12000
    };

    const res = MissingParameterResolutionEngine.resolve(known);
    // Should resolve outputRadS (DR-001) and outputTorqueNm (DR-005)
    expect(res.derivedParameters.outputRadS).toBeCloseTo(6.25, 2);
    expect(res.derivedParameters.outputTorqueNm).toBe(4800);
    expect(res.traces).toHaveLength(3);
    expect(res.traces.some(t => t.ruleId === 'DR-001')).toBe(true);
    expect(res.traces.some(t => t.ruleId === 'DR-005')).toBe(true);
    expect(res.traces.some(t => t.ruleId === 'DR-024')).toBe(true);
    expect(res.derivedParameters.powerW).toBe(30000);
  });

  it('should NEVER overwrite user provided parameters', () => {
    const known = {
      beltSpeed_m_s: 2.5,
      pulleyDiameter_m: 0.8,
      outputRadS: 12.566 // User-entered value
    };
    const userKeys = new Set(['outputRadS']);

    const res = MissingParameterResolutionEngine.resolve(known, userKeys);
    // outputRadS should remain 12.566
    expect(res.derivedParameters.outputRadS).toBe(12.566);
    expect(res.traces).toHaveLength(0); // DR-001 should be skipped
    expect(res.skips).toHaveLength(1);
    expect(res.skips[0].ruleId).toBe('DR-001');
    expect(res.skips[0].reason).toContain('already defined');
  });
});

describe('Raw Text Engineering Value Extraction', () => {
  it('should parse conveyor parameters from raw RFQ text block', () => {
    const text = `
      Required a planetary gearbox for a heavy-duty conveyor:
      - Belt speed: 2.5 m/s
      - Pulley diameter is 800 mm
      - Effective pull tension is 15 kN
    `;
    const parsed = parseInputsFromText(text);
    expect(parsed.beltSpeed_m_s).toBe(2.5);
    expect(parsed.pulleyDiameter_m).toBe(0.8); // 800mm converted to 0.8m
    expect(parsed.beltPull_N).toBe(15000); // 15kN converted to 15000N
  });

  it('should parse hoist parameters from raw RFQ text block correctly converting units', () => {
    const text = `
      Need gearbox for lifting arrangement.
      Load to be lifted: 5 Ton
      Lifting speed: 12 m/min
      Drum diameter: 400 mm
      Motor available:
      11 kW
      1450 RPM
    `;
    const result = parseInputsWithMetadata(text);
    const parsed = result.values;
    
    // Ton to N conversion: 5 * 9806.65 = 49033.25
    expect(parsed.hoistLoad_N).toBeCloseTo(49033.25, 2);
    // m/min to m/s conversion: 12 / 60 = 0.2
    expect(parsed.hoistSpeed_m_s).toBeCloseTo(0.2, 2);
    // mm to m conversion: 400 / 1000 = 0.4
    expect(parsed.drumDiameter_m).toBeCloseTo(0.4, 2);
    
    expect(result.nodes.hoistLoad_N.name).toBe('Hoist Load Force');
    expect(result.nodes.hoistSpeed_m_s.name).toBe('Lifting Speed');
    expect(result.nodes.drumDiameter_m.name).toBe('Drum Diameter');
  });
});

describe('Dependency-Based Engineering Reasoning Engine', () => {
  it('should resolve outputRadS from inputRadS and totalRatio', () => {
    const known = {
      inputRadS: 1440 * 2 * Math.PI / 60,
      totalRatio: 60
    };
    const res = MissingParameterResolutionEngine.resolve(known);
    expect(res.derivedParameters.outputRadS).toBeCloseTo(24 * 2 * Math.PI / 60, 2);
    expect(res.traces.some(t => t.ruleId === 'DR-016')).toBe(true);
  });

  it('should identify multiple alternative missing paths for outputRadS', () => {
    const known = {
      inputRadS: 1440 * 2 * Math.PI / 60
    };
    const res = MissingParameterResolutionEngine.resolve(known);
    // outputRadS should have paths like ['totalRatio'] (since inputRadS is known)
    // and application specific paths like ['beltSpeed_m_s', 'pulleyDiameter_m'], etc.
    const paths = res.missingInputsForTargets?.['outputRadS'];
    expect(paths).toBeDefined();
    
    // Check totalRatio path
    expect(paths?.some(p => p.includes('totalRatio') && p.length === 1)).toBe(true);
    
    // Check beltSpeed path
    expect(paths?.some(p => p.includes('beltSpeed_m_s') && p.includes('pulleyDiameter_m') && p.length === 2)).toBe(true);
  });

  it('should resolve the 5 mandatory outputs universally', () => {
    const known = {
      inputRadS: 1500 * 2 * Math.PI / 60,
      outputRadS: 13 * 2 * Math.PI / 60,
      powerW: 160000
    };
    const res = MissingParameterResolutionEngine.resolve(known);
    // Ratio = 1500 / 13 = 115.38
    expect(res.derivedParameters.totalRatio).toBeCloseTo(115.385, 2);
    // Stages derived from Ratio = 115.38 -> 3 stages
    expect(res.derivedParameters.stages).toBe(3);
    // Core parameters present
    expect(res.derivedParameters.powerW).toBe(160000);
    expect(res.derivedParameters.inputRadS).toBeCloseTo(1500 * 2 * Math.PI / 60, 2);
  });

  describe('New Derivation Logic Rules', () => {
    it('should calculate Power = Torque * RadS when efficiency is missing', () => {
      const known = { outputTorqueNm: 9550, outputRadS: 10 * 2 * Math.PI / 60 };
      const res = MissingParameterResolutionEngine.resolve(known);
      expect(res.derivedParameters.powerW).toBeCloseTo(9550 * 10 * 2 * Math.PI / 60, 2);
    });

    it('should calculate Power = Force * Velocity', () => {
      const known = { force_N: 2000, linearSpeed_m_s: 1.5 };
      const res = MissingParameterResolutionEngine.resolve(known);
      expect(res.derivedParameters.powerW).toBe(3000);
    });

    it('should calculate Power = Load_kg * 9.80665 * Speed_m_s', () => {
      const known = { load_kg: 100, linearSpeed_m_s: 2 };
      const res = MissingParameterResolutionEngine.resolve(known);
      expect(res.derivedParameters.powerW).toBeCloseTo(1961.33, 2);
    });

    it('should calculate Torque = Power / RadS when efficiency is missing', () => {
      const known = { powerW: 10000, outputRadS: 10 * 2 * Math.PI / 60 };
      const res = MissingParameterResolutionEngine.resolve(known);
      // Under DR-015, if efficiency is missing, we use default compounded stage efficiency (fallback to 0.97 for 1 stage)
      expect(res.derivedParameters.outputTorqueNm).toBeCloseTo((10000 * 0.97) / (10 * 2 * Math.PI / 60), 2);
    });

    it('should calculate Torque = Tangential Load * Radius', () => {
      const known = { tangentialLoad_N: 1000, radius_m: 0.5 };
      const res = MissingParameterResolutionEngine.resolve(known);
      expect(res.derivedParameters.outputTorqueNm).toBe(500);
    });

    it('should derive Torque Capacity and Output Torque from Gear Geometry (Lewis Formula)', () => {
      const known = {
        gearMaterialYield_MPa: 300,
        gearFaceWidth_mm: 50,
        gearModule_mm: 5,
        pinionTeeth: 20
      };
      const res = MissingParameterResolutionEngine.resolve(known);
      // radius_m = 5 * 20 / 2000 = 0.05
      expect(res.derivedParameters.radius_m).toBeCloseTo(0.05, 3);
      
      // Y = pi * (0.154 - 0.912 / 20) = pi * (0.154 - 0.0456) = pi * 0.1084 = 0.34055
      // W_t = 100 * 50 * 0.34055 * 5 = 8513.716
      expect(res.derivedParameters.tangentialLoad_N).toBeCloseTo(8513.716, 2);
      
      // torqueCapacity = 8513.716 * 0.05 = 425.686
      expect(res.derivedParameters.torqueCapacity).toBeCloseTo(425.686, 2);
      expect(res.derivedParameters.outputTorqueNm).toBeCloseTo(425.686, 2);
    });



    it('should derive Ratio from Gear Teeth, Pulley Diameters, and Sprocket Teeth', () => {
      const gearRes = MissingParameterResolutionEngine.resolve({ gearTeeth: 85, pinionTeeth: 17 });
      expect(gearRes.derivedParameters.totalRatio).toBe(5);

      const pulleyRes = MissingParameterResolutionEngine.resolve({ drivenPulleyDiameter_m: 0.8, driverPulleyDiameter_m: 0.2 });
      expect(pulleyRes.derivedParameters.totalRatio).toBe(4);

      const sprocketRes = MissingParameterResolutionEngine.resolve({ drivenSprocketTeeth: 45, driverSprocketTeeth: 15 });
      expect(sprocketRes.derivedParameters.totalRatio).toBe(3);
    });

    it('should calculate Application-Based Service Factor with duty/shock adjustments', () => {
      const sfConveyorDutyShock = MissingParameterResolutionEngine.resolve({
        applicationType: 'conveyor',
        is24x7Duty: true,
        isShockLoad: true
      });
      // 1.5 + 0.2 + 0.3 = 2.0
      expect(sfConveyorDutyShock.derivedParameters.serviceFactor).toBe(2.0);
    });
  });

  describe('Range Resolution Engine', () => {
    it('should resolve Ratio from range (Rule 1)', () => {
      const report = generateAuditReport(
        'planetary gearbox. Input RPM = 1000. Output RPM = 6.25. Ratio = 100-200.',
        {}
      );
      expect(report.totalRatio.value).toBe(160);
      expect(report.inputRPM.value).toBe(1000);
      expect(report.outputRPM.value).toBe(6.25);
    });

    it('should resolve Output RPM from range (Rule 2)', () => {
      const report = generateAuditReport(
        'planetary gearbox. Input RPM = 1000. Ratio = 160. Output RPM = 2-11.',
        {}
      );
      expect(report.outputRPM.value).toBe(6.25);
      expect(report.inputRPM.value).toBe(1000);
      expect(report.totalRatio.value).toBe(160);
    });

    it('should resolve Input RPM from range (Rule 3)', () => {
      const report = generateAuditReport(
        'planetary gearbox. Input RPM = 500-1500. Output RPM = 6.25. Ratio = 160.',
        {}
      );
      expect(report.inputRPM.value).toBe(1000);
      expect(report.outputRPM.value).toBe(6.25);
      expect(report.totalRatio.value).toBe(160);
    });

    it('should fail resolution and throw conflict error if derived value falls outside range (Rule 4)', () => {
      expect(() => {
        generateAuditReport(
          'planetary gearbox. Input RPM = 1000. Output RPM = 20. Ratio = 100-120.',
          {}
        );
      }).toThrow('ENGINEERING DATA CONFLICT');
    });

    it('should generate feasible range and narrow inputs for Case C1 (1 Exact + 2 Ranges)', () => {
      const report = generateAuditReport(
        'planetary gearbox. Input RPM = 500-1500. Ratio = 160. Output RPM = 5-10.',
        {}
      );
      // Provided Output Range: 5-10
      // Derived Output Range: 500/160 to 1500/160 = 3.125 to 9.375
      // Intersection: min = max(5, 3.125) = 5, max = min(10, 9.375) = 9.375
      // Resolved exactly using 1/3 rule: 5 + (9.375 - 5) / 3 = 6.4583
      expect(report.outputRPM.value).toBeCloseTo(6.4583, 3);
      expect(report.inputRPM.value).toBeCloseTo(1033.33, 2);
      expect(report.totalRatio.value).toBe(160);
    });

    it('should handle unresolved range for Case D (3 Ranges)', () => {
      const report = generateAuditReport(
        'planetary gearbox. Input RPM = 500-1500. Output RPM = 5-10. Ratio = 100-200.',
        {}
      );
      // Resolved via 1/3 range rule:
      // Input RPM: 500 + 1000/3 = 833.33
      // Output RPM: 5 + 5/3 = 6.6667
      // Ratio: 833.33 / 6.6667 = 125
      expect(report.inputRPM.value).toBeCloseTo(833.33, 2);
      expect(report.outputRPM.value).toBeCloseTo(6.6667, 3);
      expect(report.totalRatio.value).toBeCloseTo(125, 2);
    });

    it('should derive outputRadS from power and torque using DR-RPM-002', () => {
      const res = MissingParameterResolutionEngine.resolve({
        powerW: 10000,
        outputTorqueNm: 955
      });
      // RadS = 10000 / 955 = 10.47
      expect(res.derivedParameters.outputRadS).toBeCloseTo(10.47, 2);
    });

    it('should derive Design Torque from output torque and service factor using DR-TORQUE-006', () => {
      const res = MissingParameterResolutionEngine.resolve({
        outputTorqueNm: 1000,
        serviceFactor: 1.5
      });
      // DesignTorque = 1000 * 1.5 = 1500
      expect(res.derivedParameters.designTorqueNm).toBe(1500);
    });

    it('should verify 1/3 range resolution on at least 50 test cases', () => {
      for (let i = 1; i <= 50; i++) {
        const minP = 5 + i;
        const maxP = minP * 2;
        const minRPM = 500 + i * 10;
        const maxRPM = minRPM * 2;
        const minOut = 5 + i * 0.5;
        const maxOut = minOut * 2;
        const minSF = 1.0 + i * 0.01;
        const maxSF = minSF + 0.5;

        const report = generateAuditReport(
          `planetary gearbox. Motor Power = ${minP} - ${maxP} HP. Motor Speed = ${minRPM} - ${maxRPM} RPM. Output Speed = ${minOut} - ${maxOut} RPM. Service Factor = ${minSF} - ${maxSF}.`,
          {}
        );

        const expectedHP = minP + (maxP - minP) / 3;
        const expectedInputRPM = minRPM + (maxRPM - minRPM) / 3;
        const expectedOutputRPM = minOut + (maxOut - minOut) / 3;
        const expectedSF = minSF + (maxSF - minSF) / 3;

        expect(report.motorHP.value).toBeCloseTo(expectedHP, 2);
        expect(report.inputRPM.value).toBeCloseTo(expectedInputRPM, 2);
        expect(report.outputRPM.value).toBeCloseTo(expectedOutputRPM, 2);
        expect(report.serviceFactor.value).toBeCloseTo(expectedSF, 2);
      }
    });

    it('should resolve Ratio from resolved input RPM range and exact output RPM', () => {
      const report = generateAuditReport(
        'planetary gearbox. Motor RPM = 750-1500. Output RPM = 20.',
        {}
      );
      expect(report.inputRPM.value).toBe(1000);
      expect(report.outputRPM.value).toBe(20);
      expect(report.totalRatio.value).toBe(50);
    });

    it('should not match horsepower rating as input RPM speed', () => {
      const report = generateAuditReport(
        'Motor = 20 HP. Motor RPM = 1440. Required Output Speed = 24 RPM. Duty = Continuous.',
        {}
      );
      expect(report.inputRPM.value).toBe(1440);
      expect(report.outputRPM.value).toBe(24);
      expect(report.totalRatio.value).toBe(60);
    });

    it('should resolve bucket elevator parameters and validate power', () => {
      const report = generateAuditReport(
        'Application : Bucket Elevator. Capacity : 100 TPH. Lift Height : 35 m. Bucket Speed : 1.8 m/s. Head Pulley Dia : 800 mm. Motor : 22 kW. Motor RPM : 1450.',
        {}
      );
      // Output RPM = (1.8 * 60) / (pi * 0.8) = 108 / 2.51327 = 42.97 RPM
      expect(report.outputRPM.value).toBeCloseTo(42.9718, 3);
      expect(report.inputRPM.value).toBe(1450);
      // Ratio = 1450 / 42.9718 = 33.74
      expect(report.totalRatio.value).toBeCloseTo(33.743, 2);
      // Output Torque = (22 * 0.97^2 * 9549.3) / 42.97183463481174 = 4599.96 N.m (under DR-015 efficiency corrected torque with 2 stages)
      expect(report.outputTorqueNm?.value).toBeCloseTo(4599.96, 1);

      // Verify the verification check
      const verification = verifyEngineeringReport(report, {
        powerKW: 22,
        inputRPM: 1450,
        outputRPM: 42.97,
        targetRatio: 33.74,
        applicationType: 'BUCKET ELEVATOR'
      });
      
      const hasSufficientPowerMsg = verification.infos.some((inf: string) => 
        inf.includes('Power Validation: Selected motor power (22 kW) is sufficient')
      );
      expect(hasSufficientPowerMsg).toBe(true);
    });

    it('should resolve Output RPM and Ratio from Belt Speed, Pulley Diameter, Motor Power, and Motor Speed', () => {
      const report = generateAuditReport(
        'Belt Speed = 1.2 m/s, Pulley Diameter = 500 mm, Motor Power = 15 kW, Motor Speed = 1450 RPM',
        {}
      );
      expect(report.outputRPM.value).toBeCloseTo(45.837, 3);
      expect(report.totalRatio.value).toBeCloseTo(31.634, 3);
      expect(report.powerKW.value).toBe(15);
      expect(report.inputRPM.value).toBe(1450);
    });
    it('should override derived Output RPM when Ratio and Input RPM are explicitly provided, avoiding conflicts', () => {
      const report = generateAuditReport(
        'Motor RPM : 1450, Ratio : 50, Belt Speed : 1.2 m/s, Pulley Diameter : 450 mm, Power : 15 kW',
        {}
      );
      // Explicit inputs: inputRPM = 1450, Ratio = 50.
      // Derived from belt speed and pulley dia: Output RPM = 50.9296 (but this is ENGINE_RULE, so non-explicit)
      // The engine should resolve Output RPM = 1450 / 50 = 29 RPM, keeping Ratio = 50.
      expect(report.inputRPM.value).toBe(1450);
      expect(report.totalRatio.value).toBe(50);
      expect(report.outputRPM.value).toBe(29);
      expect(report.powerKW.value).toBe(15);
    });
    it('should correctly recalculate service factor for 24 hours continuous conveyor application without validation error', () => {
      const report = generateAuditReport(
        'RFQ FOR PLANETARY GEARBOX\nDrive Motor: 110 kW, 1480 RPM\nRequired Output Speed: 12 RPM\nOperating Condition: 24 Hours Continuous\nConveyor Application',
        {}
      );
      expect(report.serviceFactor.value).toBe(1.70);
      
      const verification = verifyEngineeringReport(report, {
        powerKW: 110,
        inputRPM: 1480,
        outputRPM: 12,
        applicationType: 'CONVEYOR'
      });
      expect(verification.criticalFailures).toHaveLength(0);
    });

    describe('Parameter Alias Mapping & Resolution Priority', () => {
      it('should resolve parameters using aliases (Priority 1: Direct Mapping)', () => {
        const report = generateAuditReport(
          'Drive Motor: 960 RPM. Required Output Speed = 12 RPM. Reduction = 80:1. Connected Load = 15 HP.',
          {}
        );
        expect(report.inputRPM.value).toBe(960);
        expect(report.inputRPM.type).toBe('EXTRACTED');
        expect(report.inputRPM.confidence).toBe('High');

        expect(report.outputRPM.value).toBe(12);
        expect(report.outputRPM.type).toBe('EXTRACTED');
        expect(report.outputRPM.confidence).toBe('High');

        expect(report.totalRatio.value).toBe(80);
        expect(report.totalRatio.type).toBe('EXTRACTED');
        expect(report.totalRatio.confidence).toBe('High');

        //HP converts to kW: 15 * 0.7457 = 11.1855
        expect(report.powerKW.value).toBeCloseTo(11.1855, 3);
        expect(report.powerKW.type).toBe('EXTRACTED');
        expect(report.powerKW.confidence).toBe('High');
      });

      it('should resolve input RPM from poles/hz (Priority 2: Derived Calculation)', () => {
        const report = generateAuditReport(
          'Frequency = 50 Hz. Poles = 4. Mixer Speed = 20 RPM.',
          {}
        );
        // Derived from 4 poles, 50 Hz actual speed: sync = 1500, with slip = 1450.5
        expect(report.inputRPM.value).toBeCloseTo(1450.5, 1);
        expect(report.inputRPM.type).toBe('ENGINE_RULE');
        expect(report.inputRPM.confidence).toBe('High');
      });

      it('should treat missing Input RPM as Unknown/null and log as Assumption (Priority 3 & 4)', () => {
        const report = generateAuditReport(
          'Motor = 15 HP. Mixer Speed = 20 RPM.',
          {}
        );
        // Input RPM should not be defaulted to 1440. It must be null/Unknown.
        expect(report.inputRPM.value).toBeNull();
        expect(report.inputRPM.type).toBe('ASSUMED');
        expect(report.inputRPM.confidence).toBe('Low');

        const rpmAssumption = report.assumptions.find(a => a.parameter === 'Input Speed (RPM)');
        expect(rpmAssumption).toBeDefined();
        expect(rpmAssumption?.assumption).toBe('1440 RPM');
      });
      it('should trust provided ratio directly and not throw engineering conflict even if mathematically inconsistent', () => {
        const report = generateAuditReport(
          'Gearbox Type: Bevel Planetary - Ratio: 160 - Speed: 1000 RPM - Output Speed Range: 2-11 RPM',
          {}
        );
        expect(report.totalRatio.value).toBe(160);
        expect(report.totalRatio.type).toBe('EXTRACTED');
      });

      it('should resolve parameters using PWR, INP SPD, OUT SPD, SF and LOAD : HEAVY shorthands', () => {
        const report = generateAuditReport(
          'PWR : 18.5 KW\nINP SPD : 1470 RPM\nOUT SPD : 24 RPM\nSF : 1.75\nLOAD : HEAVY',
          {}
        );
        expect(report.powerKW.value).toBe(18.5);
        expect(report.inputRPM.value).toBe(1470);
        expect(report.outputRPM.value).toBe(24);
        expect(report.serviceFactor.value).toBe(1.75);
      });
      it('should extract generic fallback input/output RPMs when on separate lines without explicit prefixes', () => {
        const report = generateAuditReport(
          'Need planetary gearbox.\n\nMotor 110 kW.\n\n1480 RPM.\n\nOutput around 12 RPM.\n\nConveyor duty.\n\nRunning 24 hrs.',
          {}
        );
        expect(report.inputRPM.value).toBe(1480);
        expect(report.outputRPM.value).toBe(12);
        expect(report.powerKW.value).toBe(110);
      });
    });

    describe('Power Resolution Engine Comprehensive Test Suite', () => {
      it('Test Case 1 - Torque + RPM (P = T * N / 9550)', () => {
        const report = generateAuditReport(
          'Output Torque : 5000 Nm\nOutput Speed : 20 RPM',
          {}
        );
        expect(report.powerKW.value).toBeCloseTo(10.47, 2);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 2 - Input Torque + Input RPM', () => {
        const report = generateAuditReport(
          'Input Torque : 300 Nm\nInput Speed : 1450 RPM',
          {}
        );
        expect(report.powerKW.value).toBeCloseTo(45.55, 2);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 3 - Conveyor Pull Method', () => {
        const report = generateAuditReport(
          'Belt Pull : 12000 N\nBelt Speed : 1.5 m/s',
          {}
        );
        expect(report.powerKW.value).toBe(18);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 4 - Chain Conveyor', () => {
        const report = generateAuditReport(
          'Chain Pull : 15000 N\nChain Speed : 0.8 m/s',
          {}
        );
        expect(report.powerKW.value).toBe(12);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 5 - Hydraulic System', () => {
        const report = generateAuditReport(
          'Pressure : 180 bar\nFlow : 250 L/min',
          {}
        );
        expect(report.powerKW.value).toBe(75);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 6 - Hoist / Winch', () => {
        const report = generateAuditReport(
          'Load : 5000 kg\nLifting Speed : 10 m/min',
          {}
        );
        expect(report.powerKW.value).toBeCloseTo(8.17, 2);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 7 - Electrical Motor', () => {
        const report = generateAuditReport(
          'Voltage : 415 V\nCurrent : 195 A\nPower Factor : 0.85\nEfficiency : 0.93',
          {}
        );
        expect(report.powerKW.value).toBeCloseTo(110.80, 1);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 8 - Planetary Gearbox', () => {
        const report = generateAuditReport(
          'Output Torque : 87500 Nm\nOutput Speed : 12 RPM',
          {}
        );
        expect(report.powerKW.value).toBeCloseTo(110.0, 0);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 9 - Bucket Elevator', () => {
        const report = generateAuditReport(
          'Capacity : 120 TPH\nLift Height : 25 m\nEfficiency : 85%',
          {}
        );
        expect(report.powerKW.value).toBeCloseTo(9.6, 1);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('Test Case 10 - Screw Conveyor', () => {
        const report = generateAuditReport(
          'Capacity : 20 TPH\nLength : 18 m\nMaterial : Fly Ash',
          {}
        );
        expect(report.powerKW.value).toBeNull();
      });

      it('Bonus Test (Range Resolution)', () => {
        const report = generateAuditReport(
          'Torque : 5000 Nm\nRPM : 20\nPower : 5-20 kW',
          {}
        );
        expect(report.powerKW.value).toBeCloseTo(10.47, 2);
        expect(report.powerKW.type).toBe('CALCULATED');
      });

      it('should parse output speed correctly from mathematical expression', () => {
        const report = generateAuditReport(
          'Output Torque = 87500 Nm\nOutput Speed = 1450 / 123 = 11.79 RPM\nGearbox Ratio = 123:1\nMotor Speed = 1450 RPM',
          {}
        );
        expect(report.outputRPM.value).toBe(11.79);
        expect(report.powerKW.value).toBeCloseTo(108.02, 1);
      });

      describe('Sizing Calculation Completeness and Symmetrical Resolve Tests', () => {
        it('should resolve single missing variable (powerKW)', () => {
          const report = generateAuditReport(
            'Motor speed 1450 RPM, Ratio 80:1, Output Torque 39517.24 Nm, Efficiency 100%',
            {}
          );
          expect(report.powerKW.value).toBeCloseTo(75, 0);
          expect(report.outputRPM.value).toBeCloseTo(18.125, 2);
        });

        it('should resolve dual missing variables (Ratio and Output RPM) with high/medium/low confidence', () => {
          const report1 = generateAuditReport(
            'Input speed 1450 RPM, Input Torque 500 Nm, Output Torque 38800 Nm, Efficiency 97%',
            {}
          );
          expect(report1.totalRatio.value).toBeCloseTo(80, 0);
          expect(report1.outputRPM.value).toBeCloseTo(18.125, 2);
          expect(report1.totalRatio.confidence).toBe('High');

          const report2 = generateAuditReport(
            'Input speed 1450 RPM, Input Torque 500 Nm, Output Torque 38800 Nm',
            {}
          );
          expect(report2.totalRatio.value).toBeCloseTo(82.5, 0);
          expect(report2.totalRatio.confidence).toBe('Medium');
          expect(report2.totalRatio.type).toBe('ASSUMED_VALUE');
        });

        it('should resolve triple missing variables (Power, Ratio, Output RPM)', () => {
          const report = generateAuditReport(
            'Input speed 1450 RPM, Input Torque 493.8 Nm, Output Torque 38320 Nm',
            {}
          );
          expect(report.powerKW.value).toBeCloseTo(75, 0);
          expect(report.totalRatio.value).toBeCloseTo(82.5, 0);
          expect(report.outputRPM.value).toBeCloseTo(17.58, 1);
        });

        it('should debug user Agitator RFQ parsing', () => {
          const rawText = `Input
Application: Agitator

Power: 22 kW
Input RPM: 1450 RPM
Output Torque: 4890 Nm`;
          const report = generateAuditReport(rawText, {});
          expect(report.powerKW.value).toBe(22);
          expect(report.inputRPM.value).toBe(1450);
          expect(report.outputRPM.value).toBeCloseTo(42.96, 1);
          expect(report.totalRatio.value).toBeCloseTo(33.74, 1);
          expect(report.stages.value).toBe(2);
        });

        it('should handle Test Case 1 - Simple RPS', () => {
          const rawText = `Input\nApplication: Conveyor\n\nInput Speed: 24 RPS\nPower: 22 kW`;
          const report = generateAuditReport(rawText, {});
          expect(report.inputRPM.value).toBeCloseTo(1440, 1);
        });

        it('should handle Test Case 2 - Decimal RPS', () => {
          const rawText = `Input\nApplication: Agitator\n\nInput Speed: 24.17 RPS\nPower: 30 kW`;
          const report = generateAuditReport(rawText, {});
          expect(report.inputRPM.value).toBeCloseTo(1450.2, 1);
        });

        it('should handle Test Case 3 - Standard Motor Verification', () => {
          const rawText = `Input\nApplication: Mixer\n\nInput Speed: 16.11 RPS`;
          const report = generateAuditReport(rawText, {});
          expect(report.inputRPM.value).toBeCloseTo(966.6, 1);
          expect(report.motorPoles.value).toBe(6);
        });

        it('should handle Test Case 4 - High Speed Motor', () => {
          const rawText = `Input\nApplication: Pump\n\nInput Speed: 48.33 RPS`;
          const report = generateAuditReport(rawText, {});
          expect(report.inputRPM.value).toBeCloseTo(2899.8, 1);
          expect(report.motorPoles.value).toBe(2);
        });

        it('should handle Test Case 5 - RPS + Ratio', () => {
          const rawText = `Input\nApplication: Conveyor\n\nInput Speed: 24 RPS\n\nRatio: 60:1`;
          const report = generateAuditReport(rawText, {});
          expect(report.inputRPM.value).toBeCloseTo(1440, 1);
          expect(report.outputRPM.value).toBeCloseTo(24, 1);
        });

        it('should handle Test Case 6 - RPS + Output Torque', () => {
          const rawText = `Input\nApplication: Agitator\n\nPower: 22 kW\n\nInput Speed: 24.17 RPS\n\nOutput Torque: 4890 Nm`;
          const report = generateAuditReport(rawText, {});
          expect(report.inputRPM.value).toBeCloseTo(1450.2, 1);
          expect(report.totalRatio.value).toBeCloseTo(33.7, 0);
          expect(report.outputRPM.value).toBeCloseTo(43, 0);
        });

        it('should handle Test Case 7 - Ambiguous Unit Detection', () => {
          const rawText = `Input\nApplication: Conveyor\n\nSpeed: 24`;
          const report = generateAuditReport(rawText, {});
          expect(report.applicationKnowledge!.isBlocked).toBe(true);
          expect(report.applicationKnowledge!.clarificationQuestions).toContain('Clarification Required');
          expect(report.applicationKnowledge!.clarificationQuestions).toContain('24 RPM?');
          expect(report.applicationKnowledge!.clarificationQuestions).toContain('24 RPS?');
          expect(report.applicationKnowledge!.clarificationQuestions).toContain('24 rad/s?');
        });

        it('should handle Killer RPS Test', () => {
          const rawText = `Input\nApplication: Agitator\n\nPower: 25 HP\n\nInput Speed: 24.17 RPS\n\nOutput Torque: 450 kgf·m`;
          const report = generateAuditReport(rawText, {});
          expect(report.powerKW.value).toBeCloseTo(18.64, 1);
          expect(report.inputRPM.value).toBeCloseTo(1450.2, 1);
          expect(report.extractedEngineeringParams!.outputTorqueNm?.value).toBeCloseTo(4413, 0);
          expect(report.totalRatio.value).toBeCloseTo(36, 0);
          expect(report.outputRPM.value).toBeCloseTo(40, 0);
        });

        it('should snap to motor poles from resolved input RPM when not explicitly provided', () => {
          const report = generateAuditReport(
            'Input speed 1000 RPM. Required Output Speed = 12 RPM. Connected Load = 15 HP.',
            {}
          );
          expect(report.inputRPM.value).toBe(1000);
          expect(report.motorPoles.value).toBe(6);
          expect(report.motorPoles.type).toBe('DERIVED');
        });
      });
    });
  });
});


