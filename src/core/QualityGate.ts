import { useCostTracker } from './CostTracker';

export interface GateResult {
  name: string;
  passed: boolean;
  score: number;
  message: string;
  details?: string;
}

export interface QualityReport {
  overallScore: number;
  gates: GateResult[];
  passed: boolean;
  criticalGates: string[];
  recommendations: string[];
}

export class QualityGate {
  private bannedWords: string[] = [
    'wholesome', 'cuddle', 'fluff', 'uwu', 'owo', 'nya', 'senpai',
    'tsundere', 'yandere', 'dere', 'kawaii', 'desu', 'baka',
  ];

  private gateThresholds: Record<string, number> = {
    dialogueCount: 60,
    voiceConsistency: 70,
    frictionGrounding: 75,
    backstoryAnchoring: 70,
  };

  check(cardContent: string): QualityReport {
    const gates: GateResult[] = [];

    gates.push(this.checkBannedWords(cardContent));
    gates.push(this.checkDialogueCount(cardContent));
    gates.push(this.checkSectionCompleteness(cardContent));
    gates.push(this.checkVoiceConsistency(cardContent));
    gates.push(this.checkFrictionGrounding(cardContent));
    gates.push(this.checkBackstoryAnchoring(cardContent));

    const totalScore = gates.reduce((sum, g) => sum + g.score, 0);
    const overallScore = Math.round(totalScore / gates.length);

    const criticalGates = ['bannedWords', 'sectionCompleteness'];
    const passed = criticalGates.every(name => 
      gates.find(g => g.name === name)?.passed
    );

    const recommendations = gates
      .filter(g => !g.passed && g.score < 70)
      .map(g => g.message);

    return {
      overallScore,
      gates,
      passed,
      criticalGates,
      recommendations,
    };
  }

  private checkBannedWords(content: string): GateResult {
    const lower = content.toLowerCase();
    const found = this.bannedWords.filter(word => lower.includes(word));
    
    return {
      name: 'bannedWords',
      passed: found.length === 0,
      score: found.length === 0 ? 100 : Math.max(0, 100 - found.length * 20),
      message: found.length === 0 
        ? 'No banned words found'
        : `Found ${found.length} banned words: ${found.join(', ')}`,
      details: found.length > 0 ? found.join(', ') : undefined,
    };
  }

  private checkDialogueCount(content: string): GateResult {
    const lines = content.split('\n');
    const dialogueLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.startsWith('`');
    });

    const count = dialogueLines.length;
    const threshold = this.gateThresholds.dialogueCount;
    const score = Math.min(100, (count / threshold) * 100);

    return {
      name: 'dialogueCount',
      passed: count >= 3, // Minimum 3 dialogue examples
      score: Math.round(score),
      message: count >= threshold
        ? `Excellent: ${count} dialogue lines`
        : count >= 3
          ? `Acceptable: ${count} dialogue lines (aim for ${threshold}+)`
          : `Too few: ${count} dialogue lines (minimum 3 required)`,
      details: `Found ${count} dialogue lines`,
    };
  }

  private checkSectionCompleteness(content: string): GateResult {
    const required = ['Name:', 'Summary:', 'Personality:', 'Scenario:'];
    const present = required.filter(section => 
      content.toLowerCase().includes(section.toLowerCase())
    );

    const score = (present.length / required.length) * 100;

    return {
      name: 'sectionCompleteness',
      passed: present.length === required.length,
      score: Math.round(score),
      message: present.length === required.length
        ? 'All required sections present'
        : `Missing sections: ${required.filter(s => !present.includes(s)).join(', ')}`,
      details: `Present: ${present.join(', ')}`,
    };
  }

  private checkVoiceConsistency(content: string): GateResult {
    const voiceIndicators = [
      /\b(stutters|mumbles|pauses|trails off|voice cracks)\b/gi,
      /\b(we|us|our)\b.*\b(i|me|my)\b/gi, // Mix of plural/singular
      /[A-Z]{3,}/g, // Excessive caps
    ];

    let issues = 0;
    for (const pattern of voiceIndicators) {
      const matches = content.match(pattern);
      if (matches) issues += matches.length;
    }

    const score = Math.max(0, 100 - issues * 5);

    return {
      name: 'voiceConsistency',
      passed: score >= this.gateThresholds.voiceConsistency,
      score: Math.round(score),
      message: issues === 0
        ? 'Voice appears consistent'
        : `Found ${issues} potential voice inconsistencies`,
      details: issues > 0 ? `${issues} potential issues detected` : undefined,
    };
  }

  private checkFrictionGrounding(content: string): GateResult {
    const hasFriction = /friction|belief|wrong|loop/i.test(content);
    const hasDemonstration = /demonstrat|example|shows|reveals/i.test(content);

    let score = 0;
    if (hasFriction) score += 50;
    if (hasDemonstration) score += 50;

    return {
      name: 'frictionGrounding',
      passed: score >= this.gateThresholds.frictionGrounding,
      score,
      message: score >= this.gateThresholds.frictionGrounding
        ? 'Friction architecture well-grounded'
        : 'Friction may need more concrete demonstration',
      details: `Friction markers: ${hasFriction ? 'yes' : 'no'}, Demonstration: ${hasDemonstration ? 'yes' : 'no'}`,
    };
  }

  private checkBackstoryAnchoring(content: string): GateResult {
    const anchorPatterns = [
      /\b(childhood|grew up|as a child|young)\b/gi,
      /\b(parents?|mother|father|family)\b/gi,
      /\b(trauma|accident|incident|event)\b/gi,
      /\b(learned|realized|discovered)\b/gi,
    ];

    let anchorCount = 0;
    for (const pattern of anchorPatterns) {
      if (pattern.test(content)) anchorCount++;
    }

    const score = (anchorCount / anchorPatterns.length) * 100;

    return {
      name: 'backstoryAnchoring',
      passed: score >= this.gateThresholds.backstoryAnchoring,
      score: Math.round(score),
      message: anchorCount >= 2
        ? 'Backstory well-anchored'
        : 'Consider adding more specific backstory anchors',
      details: `Found ${anchorCount}/${anchorPatterns.length} anchor types`,
    };
  }
}

export function createQualityGate(): QualityGate {
  return new QualityGate();
}
