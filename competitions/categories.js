/* ==========================================================================
 * 赛事总览 — 竞赛类别（学科分面）静态数据（纯 JS、零依赖，file:// 下同样可用）
 *
 * window.__COMP_CATEGORY_TAXONOMY__  四组分类体系（组 → 子分类 id/label）
 * window.__COMP_CATEGORY_MAP__       赛事编号 → 子分类 id 数组（一个赛事可挂多个）
 *   键为 HubData.normalizeNo() 归一化后的字符串；不在表内的赛事视为无分类。
 *
 * 归类由人工逐项校对得出（依据赛事名称与主办/承办单位），
 * 完整对照表见 .impeccable/review/comp-cats/classification.md（224 项全覆盖，
 * 含官方名录 185–224 的 C 类：归入现有 34 个子分类，规则与 A/B 类一致）。
 * ========================================================================== */
(function (global) {
  'use strict';

  var TAXONOMY = [
    { id: 'eng', label: '工科', items: [
      { id: 'math-model', label: '数学建模' },
      { id: 'programming', label: '程序设计' },
      { id: 'robot', label: '机器人' },
      { id: 'machinery', label: '工程机械' },
      { id: 'civil', label: '土木建筑' },
      { id: 'bigdata', label: '大数据' },
      { id: 'vehicle', label: '交通车辆' },
      { id: 'aerospace', label: '航空航天' },
      { id: 'marine', label: '船舶海洋' },
      { id: 'env-energy', label: '环境能源' },
      { id: 'computer-it', label: '计算机&信息技术' },
      { id: 'materials', label: '材料高分子' },
      { id: 'electronics', label: '电子&自动化' },
      { id: 'ai', label: '人工智能' },
    ] },
    { id: 'sci', label: '理科', items: [
      { id: 'math', label: '数学' },
      { id: 'physics', label: '物理' },
      { id: 'chemistry', label: '化学化工' },
      { id: 'health-med', label: '健康生命&医学' },
      { id: 'mechanics', label: '力学' },
    ] },
    { id: 'arts', label: '文体', items: [
      { id: 'industrial-design', label: '工业&创意设计' },
      { id: 'foreign-lang', label: '外语' },
      { id: 'speech-debate', label: '演讲主持&辩论' },
      { id: 'model', label: '模特' },
      { id: 'art-photo', label: '歌舞书画&摄影' },
      { id: 'sports', label: '体育' },
      { id: 'sci-tech-festival', label: '科技文化艺术节' },
      { id: 'ui-design', label: 'UI设计' },
      { id: 'fashion-design', label: '服装设计' },
      { id: 'esports', label: '电子竞技' },
      { id: 'art-literacy', label: '艺术素养' },
    ] },
    { id: 'biz', label: '商科', items: [
      { id: 'entrepreneurship', label: '创业' },
      { id: 'business', label: '商业' },
      { id: 'chuangqingchun', label: '创青春' },
    ] },
    // 第五组：收纳不落在具体学科桶里的综合/通用类赛事（用户已裁决）
    { id: 'zh', label: '综合', items: [
      { id: 'zh-zhcx', label: '综合创新' },
    ] },
  ];

  var MAP = {
    '1': ['entrepreneurship'],
    '2': ['zh-zhcx'],
    '3': ['entrepreneurship'],
    '4': ['entrepreneurship'],
    '5': ['zh-zhcx'],
    '6': ['entrepreneurship'],
    '7': ['zh-zhcx'],
    '8': ['machinery'],
    '9': ['materials'],
    '10': ['env-energy'],
    '11': ['env-energy'],
    '12': ['math-model'],
    '13': ['math-model'],
    '14': ['electronics'],
    '15': ['electronics'],
    '16': ['machinery'],
    '17': ['machinery', 'env-energy'],
    '18': ['civil'],
    '19': ['civil'],
    '20': ['business', 'entrepreneurship'],
    '21': ['vehicle'],
    '22': ['business'],
    '23': ['health-med'],
    '24': ['industrial-design'],
    '25': ['industrial-design'],
    '26': ['programming', 'computer-it'],
    '27': ['chemistry'],
    '28': ['health-med'],
    '29': ['entrepreneurship'],
    '30': ['foreign-lang'],
    '31': ['robot'],
    '32': ['robot', 'ai'],
    '33': ['chemistry'],
    '34': ['chemistry'],
    '35': ['health-med'],
    '36': ['env-energy'],
    '37': ['env-energy'],
    '38': ['physics'],
    '39': ['physics', 'electronics'],
    '40': ['mechanics'],
    '41': ['bigdata'],
    '42': ['business', 'bigdata'],
    '43': ['math'],
    '44': ['industrial-design'],
    '45': ['industrial-design'],
    '46': ['industrial-design'],
    '47': ['industrial-design'],
    '48': ['industrial-design'],
    '49': ['art-literacy'],
    '50': ['health-med'],
    '51': ['computer-it', 'programming'],
    '52': ['computer-it', 'programming', 'bigdata', 'ai'],
    '53': ['programming', 'computer-it'],
    '54': ['computer-it'],
    '55': ['programming', 'computer-it'],
    '56': ['computer-it'],
    '57': ['entrepreneurship'],
    '58': ['programming'],
    '59': ['computer-it'],
    '60': ['computer-it'],
    '61': ['computer-it'],
    '62': ['computer-it'],
    '63': ['ai'],
    '64': ['computer-it', 'programming'],
    '65': ['entrepreneurship', 'computer-it'],
    '66': ['electronics'],
    '67': ['electronics'],
    '68': ['electronics'],
    '69': ['electronics'],
    '70': ['machinery'],
    '71': ['robot'],
    '72': ['industrial-design'],
    '73': ['ai'],
    '74': ['robot'],
    '75': ['aerospace'],
    '76': ['industrial-design'],
    '77': ['machinery'],
    '78': ['robot'],
    '79': ['machinery'],
    '80': ['machinery'],
    '81': ['robot'],
    '82': ['robot'],
    '83': ['vehicle'],
    '84': ['vehicle'],
    '85': ['civil'],
    '86': ['civil'],
    '87': ['civil'],
    '88': ['civil'],
    '89': ['civil'],
    '90': ['civil'],
    '91': ['foreign-lang'],
    '92': ['business'],
    '93': ['art-literacy'],
    '94': ['env-energy', 'business'],
    '95': ['business'],
    '96': ['business'],
    '97': ['foreign-lang'],
    '98': ['foreign-lang'],
    '99': ['foreign-lang', 'speech-debate'],
    '100': ['foreign-lang'],
    '101': ['foreign-lang'],
    '102': ['foreign-lang'],
    '103': ['civil'],
    '104': ['business', 'entrepreneurship'],
    '105': ['entrepreneurship'],
    '106': ['business'],
    '107': ['business'],
    '108': ['business'],
    '109': ['business'],
    '110': ['business'],
    '111': ['business'],
    '112': ['art-photo'],
    '113': ['zh-zhcx'],
    '114': ['entrepreneurship'],
    '115': ['chuangqingchun', 'entrepreneurship'],
    '116': ['entrepreneurship'],
    '117': ['materials'],
    '118': ['materials'],
    '119': ['materials'],
    '120': ['materials'],
    '121': ['materials'],
    '122': ['zh-zhcx'],
    '123': ['materials', 'env-energy'],
    '124': ['materials'],
    '125': ['materials'],
    '126': ['materials'],
    '127': ['materials'],
    '128': ['chemistry'],
    '129': ['chemistry'],
    '130': ['chemistry'],
    '131': ['chemistry'],
    '132': ['chemistry'],
    '133': ['health-med'],
    '134': ['chemistry'],
    '135': ['env-energy'],
    '136': ['env-energy', 'materials'],
    '137': ['env-energy'],
    '138': ['env-energy'],
    '139': ['env-energy'],
    '140': ['env-energy'],
    '141': ['chuangqingchun', 'entrepreneurship', 'env-energy'],
    '142': ['math'],
    '143': ['math-model'],
    '144': ['math-model'],
    '145': ['industrial-design'],
    '146': ['art-literacy'],
    '147': ['industrial-design'],
    '148': ['civil'],
    '149': ['art-photo'],
    '150': ['health-med'],
    '151': ['health-med'],
    '152': ['health-med'],
    '153': ['health-med'],
    '154': ['programming', 'computer-it'],
    '155': ['ai'],
    '156': ['robot'],
    '157': ['computer-it'],
    '158': ['computer-it'],
    '159': ['programming', 'computer-it'],
    '160': ['electronics'],
    '161': ['electronics'],
    '162': ['robot'],
    '163': ['machinery'],
    '164': ['vehicle'],
    '165': ['business'],
    '166': ['civil'],
    '167': ['machinery'],
    '168': ['civil'],
    '169': ['civil'],
    '170': ['civil'],
    '171': ['civil'],
    '172': ['speech-debate'],
    '173': ['zh-zhcx'],
    '174': ['business', 'entrepreneurship'],
    '175': ['foreign-lang'],
    '176': ['foreign-lang'],
    '177': ['foreign-lang'],
    '178': ['foreign-lang'],
    '179': ['business'],
    '180': ['business'],
    '181': ['business'],
    '182': ['business'],
    '183': ['speech-debate'],
    '184': ['art-photo'],
    // ---- C 类（官方名录 185–224，2025 版全校竞赛清单新增收录）----
    '185': ['entrepreneurship'],           // 湖北省“我梦见——楚天创客”大赛
    '186': ['chemistry'],                  // 湖北省大学生化学（化工）学术创新成果报告会
    '187': ['bigdata'],                    // “泰迪杯”全国数据挖掘挑战赛
    '188': ['mechanics'],                  // 国际大学生工程力学竞赛（亚洲赛区）
    '189': ['math-model'],                 // 亚太地区大学生数学建模大赛
    '190': ['math-model'],                 // “华中杯”大学生数学建模挑战赛
    '191': ['business'],                   // 全国物流仿真设计大赛（与 22 物流设计大赛同口径）
    '192': ['health-med'],                 // 湖北省大学生医学虚拟仿真实验技能大赛
    '193': ['industrial-design'],          // 中国包装创意设计大赛
    '194': ['industrial-design'],          // 东方创意之星设计大赛
    '195': ['industrial-design'],          // 新加坡金沙艺术设计大赛
    '196': ['civil'],                      // MDV 中央空调设计应用大赛（暖通空调）
    '197': ['civil'],                      // “绿色建筑设计”技能大赛
    '198': ['civil', 'env-energy'],        // 海尔磁悬浮杯绿色设计与节能运营大赛
    '199': ['programming', 'computer-it'], // 中国大学生程序设计竞赛（与 26 同口径）
    '200': ['computer-it'],                // 全国高校计算机能力挑战赛
    '201': ['programming', 'computer-it'], // 全国大学生算法设计与编程挑战赛
    '202': ['computer-it'],                // 全国大学生IT技术大赛
    '203': ['programming', 'computer-it'], // 全国大学生算法设计和编程挑战赛
    '204': ['computer-it'],                // “新华三杯”全国大学生数字技术大赛
    '205': ['computer-it'],                // 湖北省大学生信息技术创新大赛
    '206': ['entrepreneurship', 'computer-it'], // 蓝桥杯软件创业大赛（软件 + 创业）
    '207': ['business'],                   // “哲寻杯”公共管理方案设计与决策对抗大赛
    '208': ['foreign-lang'],               // 全国学术词汇竞赛
    '209': ['foreign-lang'],               // 全国大学生英语翻译大赛（NETCCS）
    '210': ['foreign-lang'],               // 湖北省翻译大赛
    '211': ['business'],                   // “衡信杯”大学生智慧税务大赛
    '212': ['business'],                   // 全国大学生人力资源管理知识技能竞赛
    '213': ['business'],                   // “长风学霸赛之传奇大战”竞赛
    '214': ['business'],                   // “精英杯”企业经营分析与决策技能大赛
    '215': ['business'],                   // 全国高校商业精英挑战赛“云泽杯”营销模拟决策竞赛
    '216': ['business'],                   // 全国工商企业管理技能大赛
    '217': ['business'],                   // 全国高等院校人力资源决策模拟大赛
    '218': ['civil'],                      // 全国高等院校“斯维尔杯”BIM-CIM创新大赛
    '219': ['business'],                   // 全国管理决策模拟大赛
    '220': ['business'],                   // 国际供应链建模设计大赛
    '221': ['business'],                   // 全国大学生物业经营管理模拟大赛
    '222': ['business'],                   // 中国MPAcc案例大赛
    '223': ['business'],                   // 湖北省MPAcc学生案例大赛
    '224': ['business'],                   // 湖北省大学生营销策划挑战赛
  };

  global.__COMP_CATEGORY_TAXONOMY__ = TAXONOMY;
  global.__COMP_CATEGORY_MAP__ = MAP;
})(typeof window !== 'undefined' ? window : this);
