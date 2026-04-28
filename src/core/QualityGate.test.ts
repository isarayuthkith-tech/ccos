import { describe, it, expect } from 'vitest';
import { QualityGate, createQualityGate } from './QualityGate';

describe('QualityGate', () => {
  it('should detect banned words', () => {
    const gate = createQualityGate();
    const result = gate.check('This character is very wholesome and loves to cuddle');
    
    const bannedGate = result.gates.find(g => g.name === 'bannedWords');
    expect(bannedGate?.passed).toBe(false);
    expect(bannedGate?.score).toBeLessThan(100);
  });

  it('should pass when no banned words present', () => {
    const gate = createQualityGate();
    const result = gate.check('Name: John\nSummary: A serious detective');
    
    const bannedGate = result.gates.find(g => g.name === 'bannedWords');
    expect(bannedGate?.passed).toBe(true);
    expect(bannedGate?.score).toBe(100);
  });

  it('should check section completeness', () => {
    const gate = createQualityGate();
    const result = gate.check('Name: John\nSummary: Detective\nPersonality: Stern\nScenario: Office');
    
    const sectionGate = result.gates.find(g => g.name === 'sectionCompleteness');
    expect(sectionGate?.passed).toBe(true);
    expect(sectionGate?.score).toBe(100);
  });

  it('should detect missing sections', () => {
    const gate = createQualityGate();
    const result = gate.check('Name: John\nSummary: Detective');
    
    const sectionGate = result.gates.find(g => g.name === 'sectionCompleteness');
    expect(sectionGate?.passed).toBe(false);
    expect(sectionGate?.score).toBeLessThan(100);
  });

  it('should count dialogue lines', () => {
    const gate = createQualityGate();
    const content = `Name: John
Summary: Detective
"This is dialogue line one"
"This is dialogue line two"
"This is dialogue line three"`;
    
    const result = gate.check(content);
    const dialogueGate = result.gates.find(g => g.name === 'dialogueCount');
    expect(dialogueGate?.passed).toBe(true);
  });

  it('should calculate overall score', () => {
    const gate = createQualityGate();
    const result = gate.check('Name: John\nSummary: Detective\nPersonality: Stern\nScenario: Office');
    
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should provide recommendations for failed gates', () => {
    const gate = createQualityGate();
    const result = gate.check('Name: John'); // Minimal content
    
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should create gate via factory', () => {
    const gate = createQualityGate();
    expect(gate).toBeInstanceOf(QualityGate);
  });
});
