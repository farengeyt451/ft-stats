import { CommonModule, KeyValue } from "@angular/common";
import { Component, DoCheck } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { filter, fromEvent, map } from "rxjs";
import { FileDropComponent } from "./components/file-drop/file-drop.component";

interface MatchUp {
  teamName: string;
  goals: string[];
  matchUp: string;
  referee: string;
  teamStructure: string[];
}

/**
 * Ascending (smallest value first)
 * Descending (largest value first)
 */
enum SortingTypesEnum {
  Default,
  ASC,
  DESC,
}

enum StatKeysEnum {
  Games = "games",
  Goals = "goals",
  Players = "players",
}

type StatRecord = Record<
  string,
  {
    games: number;
    goals: number;
  }
>;

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, FileDropComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent implements DoCheck {
  public readonly title = "ft-stats";

  public matchUps: MatchUp[] = [];
  public refereeHash: Record<
    string,
    {
      games: number;
    }
  > = {};

  public statHash: Record<string, StatRecord> = {};

  public statHashMap: {
    [k: string]: Map<any, any>;
  } = {};

  public tableSortingState: any = {};

  public error: string = "";
  public errorLine: string = "";

  public SortingTypesEnum = SortingTypesEnum;
  public StatKeysEnum = StatKeysEnum;
  public readonly tableRowHeight = 50;
  public readonly tableColumnWidth = 220;

  constructor() {
    this.renderFileContent(this.example);
    this.formStats(this.example);
  }

  public fileContent: string = "";
  public example: string = `
  !ЗАРЯ! – УРАЛМАШ – 3-1 (0-1). 31.03. Ст-н Авангард. 7000 зр. Судья – Лушин. Состав:  Кубышкин, Найденко, Малыгин, Кузовлев, Рабочий, Оленев, Стульчин, Малышенко, Колесников, Куксов, Лукьянчук (Иванов, 46). Голы: Колесников, Колесников 69, Малышенко 71, Куксов 74.

  !МЕТАЛЛИСТ! – !СКА Од! – 2-1 (1-0). 08.05. Ст-н Металлист. 20000 зр. Судья – Ходеев. Состав: Двуреченский, Дегтярев, Поточняк, Крячко, Ледней, Шаленко (Улинец, 67), Ткаченко (Журавчак, 87), Сааков, Линке (Довбий, 88), Бачиашвили, Шеленков. – Макашвили, Николаенко, Николайшвили (Сафроненко, 46), Клыков, Умрихин, Марусин, Жарков, Смаровоз (Криштан, 46), Беланов, Корюков, Щербина (Попов, 65). Голы: Бачиашвили 15, Бачиашвили 62 – Марусин 66.
  `;

  ngDoCheck() {}

  onFileSelected(file: Event) {
    const reader = new FileReader();
    const { files } = file.target as HTMLInputElement;
    files && files.length && reader.readAsText(files[0]);

    fromEvent<ProgressEvent<FileReader>>(reader, "load")
      .pipe(
        map((val) => val.target?.result),
        filter(Boolean)
      )
      .subscribe((result) => {
        if (typeof result === "string") {
          this.renderFileContent(result);
          this.formStats(result);
        }
      });
  }

  clearData() {
    window.location.reload();
  }

  formStats(data: string) {
    const lines = data.split("\n");

    lines.forEach((line: string) => {
      this.validateLine(line) && this.sliceString(line);
    });

    this.createHashTable(this.matchUps);

    for (let team in this.statHash) {
      const m = new Map(Object.entries(this.statHash[team]));
      this.statHashMap[team] = m;
      this.tableSortingState[team] = {
        players: SortingTypesEnum.Default,
        games: SortingTypesEnum.Default,
        goals: SortingTypesEnum.Default,
      };
    }
    console.log(this.tableSortingState);
  }

  validateLine(line: string): boolean {
    return line.includes("Судья") && line.includes("Состав");
  }

  renderFileContent(value: string) {
    this.fileContent = value;
  }

  getMatchup(line: string): string {
    const MATCHUP_START = 0;
    const MATCHUP_END = line.search(/– \d+-\d+/g);
    const res = line.substring(MATCHUP_START, MATCHUP_END).trim();

    if (!res) {
      this.errorLine = `Неправильно отформатирована строка ${line}`;
      return " ";
    }
    return line.substring(MATCHUP_START, MATCHUP_END).trim();
  }

  getTeamName(matchUp: string): string {
    if (matchUp) {
      const match = matchUp.match(/!((?:\\.|[^"\\])*)!/g);
      if (!match) {
        this.error = `Неправильные скобки в строке ${matchUp}`;
        return "";
      } else {
        return match[0].replace(/!/g, "");
      }
    } else {
      throw new Error("Quotation marks are not properly placed");
    }
  }

  extractQuotedTeam(input: string) {
    const regex = /!([^!]+)!/g;
    const matches = [];
    let match;

    while ((match = regex.exec(input)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  getRefereeName(line: string) {
    const startIndex = line.indexOf("Судья");
    const endIndex = line.indexOf("Состав");

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      const referee = line.slice(startIndex + 8, endIndex - 2).trim();
      return referee;
    } else {
      this.error = `Судья не найден, ${line}`;
      throw new Error("Can not find referee");
    }
  }

  getTeamStructure(line: string) {
    const startIndex = line.indexOf("Состав");
    const lineLength = line.length;
    const goalIndex = line.indexOf("Гол:");
    const goalsIndex = line.indexOf("Голы:");
    const gi = goalIndex === -1 ? goalsIndex : goalIndex;

    const endIndex = gi === -1 ? lineLength : gi;

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      return line
        .substring(startIndex + 7, endIndex - 2)
        .trim()
        .replace(/[()]/g, "")
        .replace(/\d/g, "")
        .replace(/;/g, "")
        .split(",")
        .map((el) => el.trim().split(" "))
        .flat()
        .map((el) => el.replace(/\.$/g, ""))
        .filter(Boolean);
    } else {
      return [""];
    }
  }

  getGoals(line: string) {
    const startIndex = line.indexOf("Голы:");
    const endIndex = line.indexOf("Гол:");
    const goalsIndex = startIndex === -1 ? endIndex : startIndex;

    if (goalsIndex !== -1) {
      const goalsData = line
        .substring(goalsIndex + 5)
        .trim()
        .replace(/\d/g, "")
        .replace(/\.$/g, "")
        .split(",")
        .map((el) => el.trim().split(" "))
        .flat()
        .filter(Boolean);
      return goalsData;
    }
    return [""];
  }

  sliceString(line: string) {
    if (!line) return;

    const matchUp = this.getMatchup(line);
    const referee = this.getRefereeName(line);
    const teamStructure = this.getTeamStructure(line);
    const goals = this.getGoals(line);

    if (this.refereeHash[referee]) {
      this.refereeHash[referee].games++;
    } else {
      this.refereeHash[referee] = {
        games: 1,
      };
    }

    if (this.isDoubleMatchUp(line)) {
      const teamNames = this.extractQuotedTeam(line);
      const teamDividerIndex = teamStructure.indexOf("–");

      const teamStructure1 = teamStructure.slice(0, teamDividerIndex);
      const teamStructure2 = teamStructure.slice(
        teamDividerIndex + 1,
        teamStructure.length
      );

      let goals1: any = [];
      let goals2: any = [];

      goals.forEach((goal) => {
        if (teamStructure1.includes(goal)) {
          goals1.push(goal);
        } else {
          goals2.push(goal);
        }
      });

      teamNames.forEach((teamName, index) => {
        const match: MatchUp = {
          matchUp,
          teamName,
          referee,
          teamStructure: index === 0 ? teamStructure1 : teamStructure2,
          goals: index === 0 ? goals1 : goals2,
        };

        this.matchUps.push(match);
      });
    } else {
      const teamName = this.getTeamName(matchUp);

      const match: MatchUp = {
        matchUp,
        teamName,
        referee,
        teamStructure,
        goals,
      };

      this.matchUps.push(match);
    }
  }

  isDoubleMatchUp(line: string): boolean {
    return this.extractQuotedTeam(line).length > 1;
  }

  createHashTable(matchUps: MatchUp[]) {
    matchUps.forEach((matchUp: MatchUp) => {
      const { teamStructure, teamName, goals } = matchUp;
      const team = this.statHash[teamName];

      if (team) {
        teamStructure.forEach((fp) => {
          if (this.statHash[teamName][fp]) {
            this.statHash[teamName][fp].games++;
          } else {
            this.statHash[teamName][fp] = {
              games: 1,
              goals: 0,
            };
          }
        });

        goals.forEach((fp) => {
          if (this.statHash[teamName][fp]) {
            this.statHash[teamName][fp].goals++;
          }
        });
      } else {
        this.statHash[teamName] = {};
        teamStructure.forEach((fp) => {
          if (!this.statHash[teamName][fp]) {
            this.statHash[teamName][fp] = {
              games: 1,
              goals: 0,
            };
          }
        });

        goals.forEach((fp) => {
          if (this.statHash[teamName][fp]) {
            this.statHash[teamName][fp].goals++;
          }
        });
      }
    });
  }

  sort(teamName: string, sortKey: StatKeysEnum) {
    this.sortTableData(teamName, this.statHashMap[teamName], sortKey);
  }

  // for (let [key, value] of myObject) {
  //   console.log(key, value);
  // }

  sortTableData(
    teamName: string,
    data: Map<string, { goals: number; games: number }>,
    sortKey: StatKeysEnum
  ) {
    if (sortKey === StatKeysEnum.Goals) {
      console.log(this.tableSortingState);
      if (this.tableSortingState[teamName].goals === SortingTypesEnum.Default) {
        const sortedDesc = new Map(
          [...data.entries()].sort(([, a], [, b]) => b.goals - a.goals)
        );
        this.tableSortingState[teamName].goals = SortingTypesEnum.DESC;
        this.statHashMap[teamName] = sortedDesc;
      } else if (
        this.tableSortingState[teamName].goals === SortingTypesEnum.DESC
      ) {
        const sortedAsc = new Map(
          [...data.entries()].sort(([, a], [, b]) => a.goals - b.goals)
        );
        this.tableSortingState[teamName].goals = SortingTypesEnum.ASC;
        this.statHashMap[teamName] = sortedAsc;
      } else if (
        this.tableSortingState[teamName].goals === SortingTypesEnum.ASC
      ) {
        const sortedDesc = new Map(
          [...data.entries()].sort(([, a], [, b]) => b.goals - a.goals)
        );
        this.tableSortingState[teamName].goals = SortingTypesEnum.DESC;
        this.statHashMap[teamName] = sortedDesc;
      }
    }
  }

  originalOrder = (a: KeyValue<any, any>, b: KeyValue<any, any>): number => {
    return 0;
  };
}
