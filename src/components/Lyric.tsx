import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch } from 'vue-property-decorator';
import classNames from 'classnames';

interface LRC {
  time: number;
  text: string;
}

@Component
export default class Lyric extends Vue {
  @Prop({ type: Boolean, required: false, default: true })
  private readonly visible?: boolean;

  @Inject()
  private readonly aplayer!: {
    media: Media;
    lrcType: APlayer.LrcType;
    currentMusic: APlayer.Audio;
    currentPlayed: number;
  };

  private lrc = '';
  private isLoading = false;

  private get noLyric(): string {
    /* eslint-disable no-nested-ternary */
    const { currentMusic } = this.aplayer;
    return currentMusic.id !== undefined && Number.isNaN(currentMusic.id)
      ? '(ಗ ‸ ಗ ) 未加载音频'
      : this.isLoading
        ? '(*ゝω・) 少女祈祷中..'
        : this.lrc
          ? '(・∀・*) 抱歉，该歌词格式不支持'
          : '(,,•́ . •̀,,) 抱歉，当前歌曲暂无歌词';
    /* eslint-enable no-nested-ternary */
  }

  private get parsed(): Array<LRC> {
    return this.parseLRC(this.lrc);
  }

  private get current(): LRC {
    const { media, currentPlayed } = this.aplayer;
    const match = this.parsed.filter(
      x => x.time < currentPlayed * media.duration * 1000,
    );
    if (match && match.length > 0) return match[match.length - 1];
    return this.parsed[0];
  }

  private get transitionDuration(): number {
    return this.parsed.length > 1 ? 500 : 0;
  }

  private get translateY(): number {
    const { current, parsed } = this;
    if (parsed.length <= 0) return 0;
    const index = parsed.indexOf(current);
    const isLast = index === parsed.length - 1;
    return (isLast ? (index - 1) * 16 : index * 16) * -1;
  }

  private get style() {
    return {
      transitionDuration: `${this.transitionDuration}ms`,
      transform: `translate3d(0, ${this.translateY}px, 0)`,
    };
  }

  private getLyricFromCurrentMusic() {
    return new Promise<string>((resolve, reject) => {
      const { lrcType, currentMusic } = this.aplayer;
      if (currentMusic.id !== undefined && Number.isNaN(currentMusic.id)) {
        resolve('');
        return;
      }
      switch (lrcType) {
        case 3:
          resolve(
            currentMusic.lrc
              ? fetch(currentMusic.lrc).then(res => res.text())
              : '',
          );
          break;
        case 1:
          resolve(currentMusic.lrc);
          break;
        default:
          break;
      }
    });
  }

  private parseLRC(lrc: string): Array<LRC> {
    const reg = /\[(\d+):(\d+)[.|:](\d+)\](.+)/;
    const regTime = /\[(\d+):(\d+)[.|:](\d+)\]/g;
    const regCompatible = /\[(\d+):(\d+)]()(.+)/;
    const regTimeCompatible = /\[(\d+):(\d+)]/g;
    const regOffset = /\[offset:\s*(-?\d+)\]/;
    const offsetMatch = this.lrc.match(regOffset);
    const offset = offsetMatch ? Number(offsetMatch[1]) : 0;
    const parsed: Array<LRC> = [];

    const matchAll = (line: string) => {
      const match = line.match(reg) || line.match(regCompatible);
      if (!match || match.length !== 5) return;
      const minutes = Number(match[1]) || 0;
      const seconds = Number(match[2]) || 0;
      const milliseconds = Number(match[3]) || 0;

      const time = minutes * 60 * 1000 + seconds * 1000 + milliseconds + offset; // eslint-disable-line no-mixed-operators
      const text = (match[4] as string)
        .replace(regTime, '')
        .replace(regTimeCompatible, '');

      // 优化：不要显示空行
      if (!text) return;
      parsed.push({ time, text });
      matchAll(match[4]); // 递归匹配多个时间标签
    };

    lrc
      .replace(/\\n/g, '\n')
      .split('\n')
      .forEach(line => matchAll(line));

    if (parsed.length > 0) {
      parsed.sort((a, b) => a.time - b.time);
    }

    return parsed;
  }

  @Watch('aplayer.currentMusic.lrc', { immediate: true })
  private async handleChange() {
    this.isLoading = true;
    this.lrc = await this.getLyricFromCurrentMusic();
    this.isLoading = false;
  }

  render() {
    const {
      visible, style, lrc, parsed, current, noLyric,
    } = this;

    return (
      <div
        class={classNames({
          'aplayer-lrc': true,
          'aplayer-lrc-hide': !visible,
        })}
      >
        <div class="aplayer-lrc-contents" style={style}>
          {parsed.length > 0 ? (
            parsed.map((item, index) => (
              <p
                class={classNames({
                  'aplayer-lrc-current': current.time === item.time,
                })}
              >
                {item.text}
              </p>
            ))
          ) : (
            <p class="aplayer-lrc-current">{noLyric}</p>
          )}
        </div>
      </div>
    );
  }
}
