(() => {
  'use strict';

  const MSCI_WORLD_RETURN_PCT = {
    1970:-4.2, 1971:6.1, 1972:20.0, 1973:-28.4, 1974:-33.6, 1975:44.5, 1976:2.2,
    1977:-10.3, 1978:1.2, 1979:5.1, 1980:42.2, 1981:9.6, 1982:15.6, 1983:39.7,
    1984:21.0, 1985:9.9, 1986:11.9, 1987:-5.3, 1988:38.8, 1989:11.2, 1990:-27.0,
    1991:20.0, 1992:0.9, 1993:31.0, 1994:-5.7, 1995:11.7, 1996:23.1, 1997:33.4,
    1998:16.1, 1999:45.7, 2000:-7.3, 2001:-11.8, 2002:-32.1, 2003:10.9, 2004:6.6,
    2005:25.2, 2006:7.8, 2007:-1.4, 2008:-38.1, 2009:26.8, 2010:19.6, 2011:-2.5,
    2012:13.8, 2013:21.6, 2014:19.2, 2015:10.4, 2016:11.0, 2017:7.2, 2018:-4.2,
    2019:30.0, 2020:6.3, 2021:31.1, 2022:-12.8, 2023:19.6, 2024:26.6, 2025:7.1
  };

  const GOLD_RETURN_PCT = {
    1970:-18.9, 1971:7.6, 1972:31.8, 1973:39.0, 1974:54.0, 1975:-0.6, 1976:-20.8,
    1977:9.3, 1978:13.2, 1979:44.4, 1980:99.1, 1981:-6.9, 1982:-12.2, 1983:18.6,
    1984:-5.2, 1985:-9.2, 1986:-14.4, 1987:0.6, 1988:-4.4, 1989:-6.7, 1990:-13.5,
    1991:-2.9, 1992:-10.9, 1993:11.0, 1994:4.6, 1995:-11.6, 1996:6.0, 1997:-1.5,
    1998:-9.9, 1999:-1.1, 2000:15.5, 2001:0.1, 2002:8.2, 2003:-1.9, 2004:2.5,
    2005:8.5, 2006:34.4, 2007:5.6, 2008:16.8, 2009:17.6, 2010:32.5, 2011:22.2,
    2012:15.1, 2013:-18.2, 2014:-10.3, 2015:9.7, 2016:8.0, 2017:-1.5, 2018:-3.5,
    2019:15.8, 2020:24.5, 2021:-1.8, 2022:12.4, 2023:5.1, 2024:23.1, 2025:37.3
  };

  const SP500_RETURN_PCT = {
    1970:-3.4, 1971:9.1, 1972:9.0, 1973:-28.8, 1974:-28.4, 1975:30.5, 1976:26.6,
    1977:-14.4, 1978:-7.8, 1979:8.1, 1980:31.2, 1981:18.4, 1982:30.6, 1983:28.9,
    1984:18.4, 1985:36.2, 1986:-12.4, 1987:-12.8, 1988:14.0, 1989:40.9, 1990:-16.8,
    1991:34.1, 1992:1.0, 1993:16.8, 1994:-0.7, 1995:21.6, 1996:29.0, 1997:53.9,
    1998:30.4, 1999:26.3, 2000:4.9, 2001:-9.1, 2002:-26.2, 2003:7.6, 2004:0.8,
    2005:4.9, 2006:14.7, 2007:-3.4, 2008:-41.3, 2009:33.4, 2010:21.1, 2011:-2.8,
    2012:25.7, 2013:28.1, 2014:13.7, 2015:21.4, 2016:12.2, 2017:19.4, 2018:-8.5,
    2019:38.7, 2020:16.0, 2021:24.3, 2022:-8.0, 2023:23.0, 2024:24.9, 2025:12.9
  };

  const DE_INFLATION_PCT = {
    1970:3.45, 1971:5.24, 1972:5.48, 1973:7.03, 1974:6.99, 1975:5.91, 1976:4.25,
    1977:3.74, 1978:2.72, 1979:4.04, 1980:5.44, 1981:6.34, 1982:5.25, 1983:3.30,
    1984:2.41, 1985:2.07, 1986:-0.13, 1987:0.25, 1988:1.27, 1989:2.78, 1990:2.70,
    1991:4.04, 1992:5.07, 1993:4.48, 1994:2.69, 1995:1.71, 1996:1.45, 1997:1.94,
    1998:0.91, 1999:0.59, 2000:1.44, 2001:1.98, 2002:1.42, 2003:1.03, 2004:1.67,
    2005:1.55, 2006:1.58, 2007:2.30, 2008:2.63, 2009:0.32, 2010:1.10, 2011:2.07,
    2012:2.01, 2013:1.51, 2014:0.91, 2015:0.51, 2016:0.49, 2017:1.51, 2018:1.73,
    2019:1.45, 2020:0.15, 2021:3.07, 2022:6.86, 2023:5.99, 2024:2.26, 2025:2.20
  };

  const CRISES = [
    {y:1973, n:'Erste Ölkrise', t:'Nach dem Jom-Kippur-Krieg drosselte die OPEC die Förderung, der Ölpreis explodierte. 1973 und 1974 zusammen verlor der Index in D-Mark 52 %. Erst Ende 1981 war dieser Verlust wieder aufgeholt – die längste Durststrecke der ganzen Reihe.'},
    {y:1974, n:'Ölkrise, zweites Jahr', t:'Das zweite Verlustjahr in Folge. Wer jetzt aufgab, verpasste 1975 mit +44,5 % eines der besten Jahre überhaupt.'},
    {y:1987, n:'Schwarzer Montag', t:'Am 19. Oktober 1987 stürzten die US-Kurse an einem einzigen Tag um über 20 %. Aufs Gesamtjahr blieben in D-Mark nur −5,3 %, und schon 1988 war alles wieder aufgeholt.'},
    {y:1990, n:'Golfkrieg und Japan-Blase', t:'Der Einmarsch in Kuwait und das Platzen der japanischen Immobilien- und Aktienblase kosteten 27 %. Japan war damals der größte Posten im Index – heute sind es die USA.'},
    {y:2000, n:'Dotcom-Blase platzt', t:'Der Anfang von drei Verlustjahren in Folge: 2000 bis 2002 zusammen −44,5 %. Wer Anfang 2000 einmalig investierte, war erst Ende 2013 wieder im Plus – 14 Jahre.'},
    {y:2001, n:'Dotcom und 11. September', t:'Das zweite Verlustjahr. Der Terroranschlag traf Märkte, die ohnehin schon fielen.'},
    {y:2002, n:'Dotcom, drittes Jahr', t:'Mit −32,1 % das zweitschlechteste Jahr der Reihe. Drei rote Jahre hintereinander gab es sonst nie.'},
    {y:2008, n:'Finanzkrise', t:'Der Zusammenbruch von Lehman Brothers, −38,1 % und damit das schlechteste Jahr seit 1970. Nach fünf Jahren war der Verlust ausgeglichen.'},
    {y:2020, n:'Corona-Crash', t:'Im März brach der Markt binnen Wochen um rund ein Drittel ein – und schloss das Jahr trotzdem mit +6,3 %. Wer im Crash verkaufte, verpasste die Erholung. Im Diagramm ist der Einbruch nicht zu sehen, weil hier mit Jahreswerten gerechnet wird.'},
    {y:2022, n:'Zinswende und Ukraine', t:'Krieg, Energiepreise und die schnellsten Zinserhöhungen seit Jahrzehnten: −12,8 %. Bereits 2023 war das Minus wieder weg.'}
  ];

  globalThis.ETF_HISTORICAL = Object.freeze({
    MSCI_WORLD_RETURN_PCT, GOLD_RETURN_PCT, SP500_RETURN_PCT, DE_INFLATION_PCT, CRISES
  });
})();
