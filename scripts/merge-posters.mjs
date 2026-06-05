/**
 * 用手动英文名别名补全海报，并修正错配
 */
import fs from 'fs';
import { execSync } from 'child_process';

const MOVIES_PATH = 'data/movies.json';
const OMDB_KEY = 'trilogy';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALIASES = {
  '天气之子': 'Weathering with You',
  '大鱼': 'Big Fish',
  '小森林 冬春篇': 'Little Forest: Winter/Spring',
  '小森林 夏秋篇': 'Little Forest: Summer/Autumn',
  '萤火之森': 'Into the Forest of Fireflies Light',
  '天使爱美丽': 'Amélie',
  '你丫闭嘴！': 'Tais-toi!',
  '战狼2': 'Wolf Warrior 2',
  '大话西游之大圣娶亲': 'A Chinese Odyssey: Part 2 - Cinderella',
  '十万个冷笑话': 'One Hundred Thousand Bad Jokes',
  '沉默的证人': 'The Silent Witness',
  '哪吒闹海': 'Nezha Conquers the Dragon King',
  '瑞士军刀男': 'Swiss Army Man',
  '拯救嫌疑人': 'Last Suspect',
  '比悲伤更悲伤的故事': 'More Than Blue',
  '想见你': 'Someday or One Day',
  '金福南杀人事件始末': 'Bedevilled',
  '与犯罪的战争：坏家伙的全盛时代': 'Nameless Gangster: Rules of the Time',
  '有顶天酒店': 'The Magic Hour',
  '着魔': 'Possession',
  '喜羊羊与灰太狼之虎虎生威': 'Pleasant Goat and Big Big Wolf',
  '第六感生死缘': 'Meet Joe Black',
  '热天午后': 'Dog Day Afternoon',
  '无双': 'Project Gutenberg',
  '因果报应': 'Maharaja',
  '蓦然回首': 'Look Back',
  '鬼灭之刃：无限城篇 第一章 猗窝座再袭': 'Demon Slayer: Kimetsu no Yaiba Infinity Castle',
  '海贼王剧场版4：死亡尽头的冒险': 'One Piece: Dead End Adventure',
  '梦比优斯奥特曼和奥特兄弟': 'Ultraman Mebius & Ultraman Brothers',
  '铠甲勇士之帝皇侠': 'Armor Hero Emperor',
  '爸爸去哪儿': 'Where Are We Going, Dad?',
  '快乐到家': 'Happy Hotel',
  '特别的爱': 'Special Love',
  '万万没想到': 'Surprise',
  '爱在午夜降临前': 'Before Midnight',
  '爱在日落黄昏时': 'Before Sunset',
  '爱在黎明破晓前': 'Before Sunrise',
  '八恶人': 'The Hateful Eight',
  '大逃杀': 'Battle Royale',
  '傲慢与偏见': 'Pride & Prejudice',
  '公主日记': 'The Princess Diaries',
  '断背山': 'Brokeback Mountain',
  '纵横四海': 'Once a Thief',
  '入殓师': 'Departures',
  '借东西的小人阿莉埃蒂': 'The Secret World of Arrietty',
  '阿丽塔：战斗天使': 'Alita: Battle Angel',
  '狩猎': 'The Hunt',
  '大内密探零零发': 'Forbidden City Cop',
  '唐伯虎点秋香': 'Flirting Scholar',
  '海豚湾': 'The Cove',
  '加勒比海盗': 'Pirates of the Caribbean: The Curse of the Black Pearl',
  '未麻的部屋': 'Perfect Blue',
  '布达佩斯大饭店': 'The Grand Budapest Hotel',
  '阳光姐妹淘': 'Sunny',
  '小鞋子': 'Children of Heaven',
  '音乐之声': 'The Sound of Music',
  '哈利·波特与死亡圣器(下)': 'Harry Potter and the Deathly Hallows: Part 2',
  '哈利·波特与死亡圣器(上)': 'Harry Potter and the Deathly Hallows: Part 1',
  '哈利·波特与混血王子': 'Harry Potter and the Half-Blood Prince',
  '哈利·波特与凤凰社': 'Harry Potter and the Order of the Phoenix',
  '哈利·波特与火焰杯': 'Harry Potter and the Goblet of Fire',
  '哈利·波特与阿兹卡班的囚徒': 'Harry Potter and the Prisoner of Azkaban',
  '哈利·波特与密室': 'Harry Potter and the Chamber of Secrets',
  '哈利·波特与魔法石': 'Harry Potter and the Sorcerer\'s Stone',
  '小鬼当家': 'Home Alone',
  '美丽心灵': 'A Beautiful Mind',
  '天堂电影院': 'Cinema Paradiso',
  '惊声尖笑2': 'Scary Movie 2',
  '惊声尖笑': 'Scary Movie',
  '罗马假日': 'Roman Holiday',
  '极限职业': 'Extreme Job',
  '大闹天宫': 'Havoc in Heaven',
  '武状元苏乞儿': 'King of Beggars',
  '遗愿清单': 'The Bucket List',
  '何以为家': 'Capernaum',
  '海蒂和爷爷': 'Heidi',
  '战狼2': 'Wolf Warrior 2',
  '复仇者联盟4：终局之战': 'Avengers: Endgame',
  '无人知晓': 'Nobody Knows',
  '指环王3：王者无敌': 'The Lord of the Rings: The Return of the King',
  '指环王2：双塔奇兵': 'The Lord of the Rings: The Two Towers',
  '指环王1：护戒使者': 'The Lord of the Rings: The Fellowship of the Ring',
  '海王': 'Aquaman',
  '惊奇队长': 'Captain Marvel',
  '百变星君': 'Sixty Million Dollar Man',
  '千与千寻': 'Spirited Away',
  '厉鬼将映': 'Coming Soon',
  '爱尔兰人': 'The Irishman',
  '八部半': '8½',
  '杀出个黎明': 'From Dusk Till Dawn',
  '僵尸世界大战': 'World War Z',
  '长江七号': 'CJ7',
  '天水围的日与夜': 'The Way We Are',
  '蝙蝠侠：黑暗骑士崛起': 'The Dark Knight Rises',
  '花样年华': 'In the Mood for Love',
  '好家伙': 'Goodfellas',
  '血色将至': 'There Will Be Blood',
  '完美的日子': 'Perfect Days',
  '猜火车': 'Trainspotting',
  '蚁人': 'Ant-Man',
  '死侍2：我爱我家': 'Deadpool 2',
  '驱魔人': 'The Exorcist',
  '尖峰时刻': 'Rush Hour',
  '剑鱼行动': 'Swordfish',
  '疾速追杀': 'John Wick',
  '1917': '1917',
  '消失的她': 'Lost in the Stars',
  '逃出绝命镇': 'Get Out',
  '新喜剧之王': 'The New King of Comedy',
  '美国精神病人': 'American Psycho',
  '霍乱时期的爱情': 'Love in the Time of Cholera',
  '爱丽丝梦游仙境': 'Alice in Wonderland',
  '亚当斯一家': 'The Addams Family',
  '你逃我也逃': 'To Be or Not to Be',
  '重返十七岁': '17 Again',
  '蜘蛛侠3': 'Spider-Man 3',
  '蜘蛛侠2': 'Spider-Man 2',
  '蜘蛛侠': 'Spider-Man',
  '热天午后': 'Dog Day Afternoon',
  '碟中谍6：全面瓦解': 'Mission: Impossible - Fallout',
  '无双': 'Project Gutenberg',
  '那山那人那狗': 'Postmen in the Mountains',
  '迷雾': 'The Mist',
  '血钻': 'Blood Diamond',
  '蜘蛛侠：平行宇宙': 'Spider-Man: Into the Spider-Verse',
  '罗生门': 'Rashomon',
  '被解救的姜戈': 'Django Unchained',
  '怪兽电力公司': 'Monsters, Inc.',
  '超能陆战队': 'Big Hero 6',
  '窃听风暴': 'The Lives of Others',
  '大话西游之月光宝盒': 'A Chinese Odyssey Part One: Pandora\'s Box',
  '钢琴家': 'The Pianist',
  '触不可及': 'The Intouchables',
  '无间道': 'Infernal Affairs',
  '楚门的世界': 'The Truman Show',
  '这个杀手不太冷': 'Léon: The Professional',
  '疯狂动物城2': 'Zootopia 2',
  '前目的地': 'Predestination',
  '惊天魔盗团2': 'Now You See Me 2',
  '卧虎藏龙': 'Crouching Tiger, Hidden Dragon',
  '哪吒之魔童降世': 'Ne Zha',
  '悬崖之上': 'Cliff Walkers',
  '双宝斗恶魔': 'Tucker and Dale vs Evil',
  '这个男人来自地球': 'The Man from Earth',
  '杀死比尔': 'Kill Bill: Vol. 1',
  '长津湖之水门桥': 'The Battle at Lake Changjin II',
  '孤儿怨': 'Orphan',
  '绿里奇迹': 'The Green Mile',
  '无间道2': 'Infernal Affairs II',
  '电锯惊魂': 'Saw',
  '杀人回忆': 'Memories of Murder',
  '绿皮书': 'Green Book',
  '当幸福来敲门': 'The Pursuit of Happyness',
  '辛德勒的名单': 'Schindler\'s List',
  '阿甘正传': 'Forrest Gump',
  '死寂': 'Dead Silence',
  '头号玩家': 'Ready Player One',
  '请以你的名字呼唤我': 'Call Me by Your Name',
  '时空恋旅人': 'About Time',
  '伊甸湖': 'Eden Lake',
  '风之谷': 'Nausicaä of the Valley of the Wind',
  '上帝之城': 'City of God',
  '你的名字。': 'Your Name',
  '崖上的波妞': 'Ponyo',
  '天空之城': 'Castle in the Sky',
  '哈尔的移动城堡': "Howl's Moving Castle",
  '幽灵公主': 'Princess Mononoke',
  '海街日记': 'Our Little Sister',
  '神偷奶爸': 'Despicable Me',
  '侧耳倾听': 'Whisper of the Heart',
  '玩具总动员': 'Toy Story',
  '驯龙高手': 'How to Train Your Dragon',
  '机器人总动员': 'WALL·E',
  '飞屋环游记': 'Up',
  '寻梦环游记': 'Coco',
  '疯狂动物城': 'Zootopia',
  '狮子王': 'The Lion King',
  '泰坦尼克号': 'Titanic',
  '阿凡达': 'Avatar',
  '星际穿越': 'Interstellar',
  '盗梦空间': 'Inception',
  '肖申克的救赎': 'The Shawshank Redemption',
};

function loadOldDouban() {
  try {
    const raw = execSync('git show 8a3eecb:data/movies.json', {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return new Map(JSON.parse(raw).filter((m) => m.poster).map((m) => [m.id, m]));
  } catch {
    return new Map();
  }
}

async function omdb(title, year) {
  const tryYear = async (y) => {
    const params = new URLSearchParams({ apikey: OMDB_KEY, t: title, type: 'movie' });
    if (y) params.set('y', String(y));
    const res = await fetch(`https://www.omdbapi.com/?${params}`);
    const data = await res.json();
    if (data.Response !== 'True' || !data.Poster || data.Poster === 'N/A') return null;
    return data;
  };

  const exact = await tryYear(year);
  if (exact && Math.abs(Number(exact.Year) - Number(year)) <= 2) return exact.Poster;

  const nearby = await tryYear(Number(year) - 1);
  if (nearby && Math.abs(Number(nearby.Year) - Number(year)) <= 2) return nearby.Poster;

  const loose = await tryYear(null);
  if (loose && Math.abs(Number(loose.Year) - Number(year)) <= 2) return loose.Poster;

  return null;
}

const movies = JSON.parse(fs.readFileSync(MOVIES_PATH, 'utf8'));
const oldDouban = loadOldDouban();
let filled = 0;
let fixed = 0;

for (const m of movies) {
  const alias = ALIASES[m.title];
  const hadDouban = m.poster?.includes('doubanio');

  if (alias && (!m.poster || hadDouban || m.poster.startsWith('images/'))) {
    const poster = await omdb(alias, m.year);
    await sleep(220);
    if (poster) {
      if (m.poster !== poster) {
        m.poster = poster;
        if (hadDouban) fixed++;
        else filled++;
      }
      continue;
    }
  }

  if (!m.poster) {
    const old = oldDouban.get(m.id);
    if (old && old.title === m.title && old.year === m.year) {
      m.poster = old.poster;
      filled++;
    }
  }
}

fs.writeFileSync(MOVIES_PATH, JSON.stringify(movies, null, 2) + '\n', 'utf8');

const stats = movies.reduce(
  (acc, m) => {
    if (!m.poster) acc.empty++;
    else if (m.poster.includes('doubanio')) acc.douban++;
    else if (m.poster.startsWith('images/')) acc.local++;
    else acc.amazon++;
    return acc;
  },
  { empty: 0, douban: 0, local: 0, amazon: 0 }
);

console.log('stats', stats);
