/* sampleData.js — 初回起動時に投入するサンプルキャラクター。
 * 色相環上の配置とタグ絞り込みの動作を確認できるよう、色相・タグを分散させている。
 */
(function (global) {
  'use strict';

  function make(partial) {
    const now = new Date().toISOString();
    return Object.assign({
      id: Utils.uuid(),
      name: '',
      image: '',
      color: '#888888',
      system: '',
      scenario: '',
      ho: '',
      age: '',
      occupation: '',
      description: '',
      tags: [],
      iacharaUrl: '',
      source: 'manual',
      createdAt: now,
      updatedAt: now
    }, partial);
  }

  global.SAMPLE_CHARACTERS = [
    make({
      name: '紅月 燐',
      color: '#e63946',
      system: 'クトゥルフ神話TRPG 6版',
      scenario: '孤島の悲鳴',
      ho: 'HO1',
      age: '24',
      occupation: '私立探偵',
      description: '直感型の探偵。仲間を守るためなら無茶をする。',
      tags: ['男性']
    }),
    make({
      name: '緋崎 灼',
      color: '#f4511e',
      system: 'クトゥルフ神話TRPG 6版',
      scenario: '孤島の悲鳴',
      ho: 'HO2',
      age: '19',
      occupation: '大学生',
      description: '好奇心旺盛だが臆病。異形を見て以来眠れない夜が続く。',
      tags: ['男性']
    }),
    make({
      name: '橙寺 環',
      color: '#f39c12',
      system: 'クトゥルフ神話TRPG 7版',
      scenario: '森の中の小さな家',
      ho: 'HO3',
      age: '31',
      occupation: '医師',
      description: '冷静沈着な町医者。PCの怪我を淡々と処置する。',
      tags: ['女性']
    }),
    make({
      name: '黄泉川 陽菜',
      color: '#f1c40f',
      system: 'インセイン',
      scenario: '黄昏の学舎',
      ho: '',
      age: '16',
      occupation: '高校生',
      description: '明るく振る舞うが、心の傷を隠している。',
      tags: ['女性']
    }),
    make({
      name: '萌黄 千歳',
      color: '#7cb342',
      system: 'クトゥルフ神話TRPG 6版',
      scenario: '悪霊の家',
      ho: 'HO1',
      age: '27',
      occupation: '記者',
      description: '真実を追う記者。KPとして進行役を務めることも多い。',
      tags: ['男性']
    }),
    make({
      name: '深緑 澄',
      color: '#2e7d32',
      system: 'クトゥルフ神話TRPG 7版',
      scenario: '深海より来たる者',
      ho: 'HO2',
      age: '35',
      occupation: '海洋学者',
      description: '海に魅せられ、そして海に呑まれかけた研究者。',
      tags: ['男性']
    }),
    make({
      name: '藍瀬 燈',
      color: '#26a69a',
      system: 'シノビガミ',
      scenario: '桜降る代に決断を',
      ho: '',
      age: '22',
      occupation: '忍者',
      description: '任務のためなら仲間さえも欺く覚悟を持つ。',
      tags: ['男性']
    }),
    make({
      name: '碧海 蒼真',
      color: '#1e88e5',
      system: 'クトゥルフ神話TRPG 6版',
      scenario: '孤島の悲鳴',
      ho: 'HO4',
      age: '29',
      occupation: '船乗り',
      description: '寡黙だが頼れる仲間。嵐の中でも動じない。',
      tags: ['男性']
    }),
    make({
      name: '瑠璃谷 雫',
      color: '#3949ab',
      system: 'クトゥルフ神話TRPG 7版',
      scenario: '狂気山脈',
      ho: 'HO1',
      age: '26',
      occupation: '登山家',
      description: '未踏の地を目指すうちに、戻れない一線を越えてしまった。',
      tags: ['女性']
    }),
    make({
      name: '菫堂 紫苑',
      color: '#8e24aa',
      system: 'クトゥルフ神話TRPG 6版',
      scenario: '悪霊の家',
      ho: 'HO3',
      age: '40',
      occupation: '骨董商',
      description: 'いわくつきの品を扱ううちに何かに目をつけられた。',
      tags: ['男性']
    }),
    make({
      name: '紫紺 玲',
      color: '#5e35b1',
      system: 'マレウス・モンストロルム',
      scenario: '未使用',
      ho: '',
      age: '不明',
      occupation: '狩人',
      description: 'まだ実戦投入していないプール中のキャラクター。',
      tags: ['女性']
    }),
    make({
      name: '桃花 梓',
      color: '#d81b60',
      system: 'クトゥルフ神話TRPG 7版',
      scenario: '森の中の小さな家',
      ho: 'HO2',
      age: '18',
      occupation: '看護学生',
      description: '人の役に立ちたい一心で危険な現場に飛び込む。',
      tags: ['女性']
    })
  ];
})(window);
