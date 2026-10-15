import { describe, it, expect } from 'vitest';
import { detectInstallEnv, externalOpenUrl } from '../../src/ui/install';

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410310',
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
  naverAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.9.1)',
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
};

describe('detectInstallEnv', () => {
  it.each([
    ['chromeAndroid', 'android'],
    ['samsung', 'android'],
    ['kakaoAndroid', 'kakao'],
    ['kakaoIos', 'kakao'],
    ['naverAndroid', 'inapp-android'],
    ['iosSafari', 'ios-safari'],
    ['iosChrome', 'ios-other'],
    ['desktop', 'desktop'],
  ] as const)('%s → %s', (key, env) => {
    expect(detectInstallEnv(UA[key], false)).toBe(env);
  });
  it('already installed wins', () => {
    expect(detectInstallEnv(UA.chromeAndroid, true)).toBe('installed');
  });
});

describe('externalOpenUrl', () => {
  const url = 'https://sh0106015-dot.github.io/gagybu/?install=1';
  it('asks KakaoTalk to open the page in the default browser', () => {
    expect(externalOpenUrl('kakao', url)).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`);
  });
  it('uses an Android intent for other in-app browsers', () => {
    expect(externalOpenUrl('inapp-android', url)).toBe(
      'intent://sh0106015-dot.github.io/gagybu/?install=1#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
  it('does nothing elsewhere', () => {
    expect(externalOpenUrl('android', url)).toBeUndefined();
  });
});
