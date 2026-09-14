/**
 * 가나 읽기 → 로마자(모라 단위 하이픈) + 한글 발음(교재식 관용) 규칙 변환.
 * 모델 출력 대신 클라이언트에서 결정적으로 생성해 표기 일관성과 속도를 확보한다.
 * 표기 규칙: 장음 모음 반복(りょこう→ryo-ko-o/료코오), っ=뒤 자음 중복·받침 ㅅ,
 * ん=n·받침(ㄴ/ㅇ/ㅁ, 뒤 자음에 따라), 어두 청음도 격음 통일(카/타).
 */
import { katakanaToHiragana } from "./similarity";

const SMALL_KANA = "ゃゅょぁぃぅぇぉ";
const PUNCT_RE = /[、。！？!?.,・「」『』（）()\s~〜ー-]/; // ー는 별도 처리하므로 여기서 제외하면 안 됨 → 아래 로직에서 우선 처리

const ROMAJI: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ゔ: "vu",
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  しぇ: "she", ちぇ: "che", じぇ: "je",
  てぃ: "ti", でぃ: "di", とぅ: "tu", どぅ: "du",
  ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo",
  うぃ: "wi", うぇ: "we", うぉ: "wo",
};

const HANGUL: Record<string, string> = {
  あ: "아", い: "이", う: "우", え: "에", お: "오",
  か: "카", き: "키", く: "쿠", け: "케", こ: "코",
  さ: "사", し: "시", す: "스", せ: "세", そ: "소",
  た: "타", ち: "치", つ: "츠", て: "테", と: "토",
  な: "나", に: "니", ぬ: "누", ね: "네", の: "노",
  は: "하", ひ: "히", ふ: "후", へ: "헤", ほ: "호",
  ま: "마", み: "미", む: "무", め: "메", も: "모",
  や: "야", ゆ: "유", よ: "요",
  ら: "라", り: "리", る: "루", れ: "레", ろ: "로",
  わ: "와", を: "오",
  が: "가", ぎ: "기", ぐ: "구", げ: "게", ご: "고",
  ざ: "자", じ: "지", ず: "즈", ぜ: "제", ぞ: "조",
  だ: "다", ぢ: "지", づ: "즈", で: "데", ど: "도",
  ば: "바", び: "비", ぶ: "부", べ: "베", ぼ: "보",
  ぱ: "파", ぴ: "피", ぷ: "푸", ぺ: "페", ぽ: "포",
  ゔ: "부",
  きゃ: "캬", きゅ: "큐", きょ: "쿄",
  しゃ: "샤", しゅ: "슈", しょ: "쇼",
  ちゃ: "차", ちゅ: "추", ちょ: "초",
  にゃ: "냐", にゅ: "뉴", にょ: "뇨",
  ひゃ: "햐", ひゅ: "휴", ひょ: "효",
  みゃ: "먀", みゅ: "뮤", みょ: "묘",
  りゃ: "랴", りゅ: "류", りょ: "료",
  ぎゃ: "갸", ぎゅ: "규", ぎょ: "교",
  じゃ: "자", じゅ: "주", じょ: "조",
  びゃ: "뱌", びゅ: "뷰", びょ: "뵤",
  ぴゃ: "퍄", ぴゅ: "퓨", ぴょ: "표",
  しぇ: "셰", ちぇ: "체", じぇ: "제",
  てぃ: "티", でぃ: "디", とぅ: "투", どぅ: "두",
  ふぁ: "화", ふぃ: "휘", ふぇ: "훼", ふぉ: "훠",
  うぃ: "위", うぇ: "웨", うぉ: "워",
};

const VOWEL_HANGUL: Record<string, string> = { a: "아", i: "이", u: "우", e: "에", o: "오" };

/** 종성(받침) 인덱스: ㄴ=4, ㅁ=16, ㅅ=19, ㅇ=21 */
const JONG = { n: 4, m: 16, s: 19, ng: 21 } as const;

function splitMora(hira: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < hira.length; i++) {
    const pair = hira[i] + (hira[i + 1] ?? "");
    if (hira[i + 1] && SMALL_KANA.includes(hira[i + 1]) && (ROMAJI[pair] || HANGUL[pair])) {
      out.push(pair);
      i++;
    } else {
      out.push(hira[i]);
    }
  }
  return out;
}

function lastVowel(roma: string[]): string | undefined {
  for (let i = roma.length - 1; i >= 0; i--) {
    const c = roma[i][roma[i].length - 1];
    if ("aiueo".includes(c)) return c;
  }
  return undefined;
}

export interface Transliteration {
  /** 모라 단위 하이픈 로마자 (예: "ryo-ko-o") */
  romaji: string;
  /** 한글 발음 (예: "료코오") */
  hangul: string;
}

export function transliterateKana(kana: string): Transliteration {
  const hira = katakanaToHiragana(kana.normalize("NFKC"));
  const moras = splitMora(hira);
  const roma: string[] = [];
  const hang: string[] = [];

  /** 직전 한글 음절에 받침을 붙인다 (받침 자리가 없으면 낱자 폴백) */
  const addBatchim = (jong: number, fallback: string) => {
    const last = hang[hang.length - 1];
    const code = last?.charCodeAt(last.length - 1) ?? 0;
    if (last && code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 0) {
      hang[hang.length - 1] = last.slice(0, -1) + String.fromCharCode(code + jong);
    } else {
      hang.push(fallback);
    }
  };

  for (let i = 0; i < moras.length; i++) {
    const m = moras[i];
    const nextRoma = moras[i + 1] ? ROMAJI[moras[i + 1]] : undefined;

    if (m === "っ") {
      let c = nextRoma?.[0] ?? "t";
      if (nextRoma?.startsWith("ch")) c = "t";
      roma.push(c);
      addBatchim(JONG.s, "ㅅ");
      continue;
    }
    if (m === "ん") {
      roma.push("n");
      const c = nextRoma?.[0];
      if (c === "k" || c === "g") addBatchim(JONG.ng, "ㅇ");
      else if (c === "m" || c === "b" || c === "p") addBatchim(JONG.m, "ㅁ");
      else addBatchim(JONG.n, "ㄴ");
      continue;
    }
    if (m === "ー") {
      const v = lastVowel(roma);
      if (v) {
        roma.push(v);
        hang.push(VOWEL_HANGUL[v]);
      }
      continue;
    }
    // 장음: お단 + う → 모음 반복 (りょこう → ryo-ko-o / 료코오)
    if (m === "う" && lastVowel(roma) === "o") {
      roma.push("o");
      hang.push("오");
      continue;
    }
    const r = ROMAJI[m];
    const h = HANGUL[m];
    if (r && h) {
      roma.push(r);
      hang.push(h);
      continue;
    }
    // 구두점은 건너뛰고, 숫자·라틴 등은 그대로 통과
    if (PUNCT_RE.test(m)) continue;
    roma.push(m);
    hang.push(m);
  }

  return { romaji: roma.join("-"), hangul: hang.join("") };
}
