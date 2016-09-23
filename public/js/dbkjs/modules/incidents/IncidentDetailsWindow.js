/*
 *  Copyright (c) 2015 B3Partners (info@b3partners.nl)
 *
 *  This file is part of safetymapDBK
 *
 *  safetymapDBK is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  safetymapDBK is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with safetymapDBK. If not, see <http://www.gnu.org/licenses/>.
 *
 */

/**
 * Window which shows incident details. Subclass of SplitScreenWindow. Create
 * only one instance as it always uses modal popup name "incidentDetails".
 * @returns {IncidentDetailsWindow}
 */
function IncidentDetailsWindow() {
    SplitScreenWindow.call(this, "incidentDetails");

    this.ghor = dbkjs.modules.incidents.options.ghor;

    this.createStyle();

    $(this).on('elements_created', function() {
        var v = ModalWindow.prototype.getView.call(this);
        v.html("Bezig...");
    });
}

IncidentDetailsWindow.prototype = Object.create(SplitScreenWindow.prototype);
IncidentDetailsWindow.prototype.constructor = IncidentDetailsWindow;

IncidentDetailsWindow.prototype.showError = function(e) {
    this.getView().text(e);
};

IncidentDetailsWindow.prototype.createStyle = function() {
    var me = this;
    var css = '#eenheden div { margin: 3px; float: left } \
#eenheden div { border-left: 1px solid #ddd; padding-left: 8px; } \
#eenheden span.einde { color: gray } \
#kladblok { clear: both; padding-top: 10px; white-space: pre; } \
#kladblok span.brw { font-weight: bold; color: red } \
#kladblok span.pol { color: blue; } \
#pol span { color: blue; } \
#kladblok span.ambu { color: orange; ' + (me.ghor ? '' : 'display: none;') + ' } \
table td { padding: 3px !important; } \
';
        head = document.getElementsByTagName('head')[0],
        style = document.createElement('style');

    style.type = 'text/css';
    if(style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
};

/**
 * Render an incident in the window view.
 * @param {object} incident Complete incident from AGSIncidentService.getAllIncidentInfo()
 * @param {boolean} restoreScrollTop
 * @returns {undefined}
 */
IncidentDetailsWindow.prototype.data = function(incident, showInzet, restoreScrollTop, isXml, lastModified) {
    var v = this.getView();
    var scrollTop = v.scrollTop();

    v.css("-webkit-overflow-scrolling", "touch");
    v.html("");
    if(typeof incident === "string") {
        v.text(incident);
        return;
    }

    v.html(isXml ? this.getXmlIncidentHtml(incident, showInzet, false, lastModified) : this.getIncidentHtml(incident, showInzet, false));

    if(restoreScrollTop) {
        v.scrollTop(scrollTop);
    }
};

/**
 * Get HTML to display incident. Boolean specificies whether to leave out time
 * dependent information ('1 minute ago') to compare changes.
 * @param {object} incident
 * @param {boolean} showInzet show voertuig inzet
 * @param {boolean} compareMode the result should only depend on the incident
 *   parameter, not other factors such as current time
 * @returns {undefined}
 */
IncidentDetailsWindow.prototype.getIncidentHtml = function(incident, showInzet, compareMode) {
    var me = this;

    if(incident.IncidentNummer) {
        return me.getIncidentHtmlFalck(incident, showInzet, compareMode);
    }

    var html = '<div style="width: 100%" class="table-responsive incidentDetails">';
    html += '<table class="table table-hover">';

    var columns = [
        { property: 'DTG_START_INCIDENT', date: true, label: 'Start incident' },
        { property: 'T_GUI_LOCATIE', date: false, label: 'Adres' },
        { property: 'POSTCODE', date: false, label: 'Postcode' },
        { property: 'PLAATS_NAAM', date: false, label: 'Woonplaats' },
        { property: 'PRIORITEIT_INCIDENT_BRANDWEER', date: false, label: me.ghor ? 'Prioriteit brandweer' : 'Prioriteit', separate: true }
    ];
    if(me.ghor) {
        columns.push({ property: 'PRIORITEIT_INCIDENT_POLITIE', date: false, label: 'Prioriteit politie', separate: false});
    }

    $.each(columns, function(i, column) {
        var p = incident[column.property];
        if (!dbkjs.util.isJsonNull(p)) {
            var v;
            if(column.date) {
                var d = AGSIncidentService.prototype.getAGSMoment(p);
                v = d.format("dddd, D-M-YYYY HH:mm:ss") + (compareMode ? "" : " (" + d.fromNow() + ")");
            } else {
                v = dbkjs.util.htmlEncode(p);
            }
            if(column.separate) {
                html += '<tr><td>&nbsp;</td><td></td></tr>';
            }
            html += '<tr><td><span>' + column.label + "</span>: </td><td>" + v + "</td></tr>";
        }
    });

    html += '<tr><td>Melding classificatie:</td><td>' + dbkjs.util.htmlEncode(incident.classificatie) + '</td></tr>';

    if(!incident.karakteristiek || incident.karakteristiek.length === 0) {
        html += '<tr><td>Karakteristieken:</td><td>';
        html += "<h4>-</h4>";
    } else {
        html += '<tr><td colspan="2">Karakteristieken:<br/>';
        html += '<div class="table-responsive" style="margin: 0px 10px 0px 10px">';
        html += '<table class="table table-hover" style="width: auto">';
        $.each(incident.karakteristiek, function(i, k) {
            if(!k.ACTUELE_KAR_WAARDE) {
                return;
            }
            html += "<tr><td>" + dbkjs.util.htmlEncode(k.NAAM_KARAKTERISTIEK) + "</td><td>" + dbkjs.util.htmlEncode(k.ACTUELE_KAR_WAARDE) + "</td></tr>";
        });
        html += '</table><div/>';
    }
    html += '</td></tr>';

    if(showInzet) {
        html += '<tr><td colspan="2" id="eenheden">';
        var eenhBrw = "", eenhPol = "", eenhAmbu = "";
        $.each(incident.inzetEenheden, function(i, inzet) {
            var eenheid = (inzet.CODE_VOERTUIGSOORT ? inzet.CODE_VOERTUIGSOORT : "") + " " + inzet.ROEPNAAM_EENHEID;
            if(inzet.KAZ_NAAM) {
                eenheid += " (" + inzet.KAZ_NAAM + ")";
            }
            var tooltip;
            if(!inzet.DTG_EIND_ACTIE) {
                var start = AGSIncidentService.prototype.getAGSMoment(inzet.DTG_OPDRACHT_INZET);
                tooltip = "sinds " + start.format("HH:mm") + ", " + start.fromNow();
            } else {
                var einde = AGSIncidentService.prototype.getAGSMoment(inzet.DTG_EIND_ACTIE);
                tooltip = "actie be&euml;indigd om " + einde.format("HH:mm") + ", " + einde.fromNow();
            }

            var span = (inzet.DTG_EIND_ACTIE ? "<span class='einde' " : "<span ") + " title='" + tooltip + "'>" + dbkjs.util.htmlEncode(eenheid) + "</span><br/>";
            if(inzet.T_IND_DISC_EENHEID === "B") {
                eenhBrw += span;
            } else if(inzet.T_IND_DISC_EENHEID === "P") {
                eenhPol += span;
            } else if(inzet.T_IND_DISC_EENHEID === "A") {
                eenhAmbu += span;
            }
        });
        html += '<div id="brw"><b>Brandweer</b><br/>' + eenhBrw + '</div>';
        html += '<div id="pol"><b>Politie</b><br/>' + eenhPol + '</div>';
        html += '<div id="ambu"><b>Ambu</b><br/>' + eenhAmbu + '</div>';
        html += '</td></tr>';
    }

    if(incident.kladblok && incident.kladblok.length !== 0) {
        html += '<tr><td id="kladblok" colspan="2">';
        var pre = "";
        $.each(incident.kladblok, function(i, k) {
            var c = "";
            var ind = k.T_IND_DISC_KLADBLOK_REGEL;
            if(ind.indexOf("B") !== -1) {
                c += "brw ";
            } else {
                if(typeof dbkjs.options.incidents.kladblokP === "undefined" || !dbkjs.options.incidents.kladblokP) {
                    return;
                }
            }
            if(ind.indexOf("P") !== -1) {
                c += "pol ";
            }
            if(ind.indexOf("A") !== -1) {
                c += "ambu ";
            }
            pre += "<span class='" + c + "'>" + AGSIncidentService.prototype.getAGSMoment(k.DTG_KLADBLOK_REGEL).format("HH:mm ") +
                    dbkjs.util.htmlEncode(k.INHOUD_KLADBLOK_REGEL) + "\n</span>";

        });
        html += "Kladblok:<br/>" + pre + "</pre>";
        html += '</td></tr>';
    }

    html += '</table>';

    return html;
};

IncidentDetailsWindow.prototype.getIncidentHtmlFalck = function(incident, showInzet, compareMode) {
    var me = this;

    var html = '<div style="width: 100%" class="table-responsive incidentDetails">';
    html += '<table class="table table-hover">';

    var d;
    d = new moment(incident.BrwDisciplineGegevens.StartDTG);

    html += '<tr><td><span>Start incident</span>: </td><td>' + d.format("dddd, D-M-YYYY HH:mm:ss")  + (compareMode ? "" : " (" + d.fromNow() + ")") + '</td></tr>';
    var a = incident.IncidentLocatie;
    html += '<tr><td><span>Adres:</span>: </td><td>' + a.NaamLocatie1 + " " + a.Huisnummer + a.HnToevoeging + " " + a.HnAanduiding + '</td></tr>';
    html += '<tr><td><span>Postcode:</span>: </td><td>' + a.Postcode + '</td></tr>';
    html += '<tr><td><span>Woonplaats:</span>: </td><td>' + a.Plaatsnaam + '</td></tr>';

    var c = [];
    var m = incident.BrwDisciplineGegevens;
    if(m.Meldingsclassificatie1) {
        c.push(m.Meldingsclassificatie1);
    }
    if(m.Meldingsclassificatie2) {
        c.push(m.Meldingsclassificatie2);
    }
    if(m.Meldingsclassificatie3) {
        c.push(m.Meldingsclassificatie3);
    }

    html += '<tr><td>Melding classificatie:</td><td>' + c.join(", ") + '</td></tr>';

    if(!incident.Karakteristieken || incident.Karakteristieken.length === 0) {
        html += '<tr><td>Karakteristieken:</td><td>';
        html += "<h4>-</h4>";
    } else {
        html += '<tr><td colspan="2">Karakteristieken:<br/>';
        html += '<div class="table-responsive" style="margin: 0px 10px 0px 10px">';
        html += '<table class="table table-hover" style="width: auto">';
        $.each(incident.Karakteristieken, function(i, k) {
            html += "<tr><td>" + dbkjs.util.htmlEncode(k.Naam) + "</td><td>" + dbkjs.util.htmlEncode(k.Waarden.join(", ")) + "</td></tr>";
        });
        html += '</table><div/>';
    }
    html += '</td></tr>';
/*
    if(showInzet) {
        html += '<tr><td colspan="2" id="eenheden">';
        var eenhBrw = "", eenhPol = "", eenhAmbu = "";
        $.each(incident.inzetEenheden, function(i, inzet) {
            var eenheid = (inzet.CODE_VOERTUIGSOORT ? inzet.CODE_VOERTUIGSOORT : "") + " " + inzet.ROEPNAAM_EENHEID;
            if(inzet.KAZ_NAAM) {
                eenheid += " (" + inzet.KAZ_NAAM + ")";
            }
            var tooltip;
            if(!inzet.DTG_EIND_ACTIE) {
                var start = AGSIncidentService.prototype.getAGSMoment(inzet.DTG_OPDRACHT_INZET);
                tooltip = "sinds " + start.format("HH:mm") + ", " + start.fromNow();
            } else {
                var einde = AGSIncidentService.prototype.getAGSMoment(inzet.DTG_EIND_ACTIE);
                tooltip = "actie be&euml;indigd om " + einde.format("HH:mm") + ", " + einde.fromNow();
            }

            var span = (inzet.DTG_EIND_ACTIE ? "<span class='einde' " : "<span ") + " title='" + tooltip + "'>" + dbkjs.util.htmlEncode(eenheid) + "</span><br/>";
            if(inzet.T_IND_DISC_EENHEID === "B") {
                eenhBrw += span;
            } else if(inzet.T_IND_DISC_EENHEID === "P") {
                eenhPol += span;
            } else if(inzet.T_IND_DISC_EENHEID === "A") {
                eenhAmbu += span;
            }
        });
        html += '<div id="brw"><b>Brandweer</b><br/>' + eenhBrw + '</div>';
        html += '<div id="pol"><b>Politie</b><br/>' + eenhPol + '</div>';
        html += '<div id="ambu"><b>Ambu</b><br/>' + eenhAmbu + '</div>';
        html += '</td></tr>';
    }
*/
    if(incident.Kladblokregels && incident.Kladblokregels.length !== 0) {
        html += '<tr><td id="kladblok" colspan="2">';
        var pre = "";
        $.each(incident.Kladblokregels, function(i, k) {
            pre += "<span class='brw'>" + new moment(k.DTG).format("HH:mm ") +
                    dbkjs.util.htmlEncode(k.Inhoud) + "\n</span>";

        });
        html += "Kladblok:<br/>" + pre + "</pre>";
        html += '</td></tr>';
    }

    html += '</table>';

    return html;
};

/**
 * Get HTML to display XML incident. Boolean specificies whether to leave out
 * time dependent information ('1 minute ago') to compare changes.
 * @param {xml object} incident
 * @param {boolean} showInzet show voertuig inzet
 * @param {boolean} compareMode the result should only depend on the incident
 *   parameter, not other factors such as current time
 * @returns {undefined}
 */
IncidentDetailsWindow.prototype.getXmlIncidentHtml = function(incident, showInzet, compareMode, lastModified) {
    var html = '<div style="width: 100%" class="table-responsive incidentDetails">';
    html += '<table class="table table-hover">';

    var template = "{{#separator}}<tr><td>&nbsp;</td><td></td></tr>{{/separator}}<tr><td><span>{{label}}</span>: </td><td>{{value}}</td></tr>";

    var startS = $(incident).find("StartDatumTijd").text();
    var v = "";
    if(startS !== "") {
        var d = moment(startS);
        v = d.format("dddd, D-M-YYYY HH:mm:ss") + (compareMode ? "" : " (" + d.fromNow() + ")");
    } else if(lastModified) {
        var d = moment(lastModified);
        v = d.format("dddd, D-M-YYYY HH:mm:ss") + (compareMode ? "" : " (" + d.fromNow() + ")");
    }
    html += Mustache.render(template, { label: "Start incident", value: v});

    var adres = $(incident).find("IncidentLocatie Adres");
    v = Mustache.render("{{#x}}Straat{{/x}} {{#x}}Huisnummer{{/x}}{{#x}}HnToevoeging{{/x}} {{#x}}HnAanduiding{{/x}}", {
        x: function() {
            return function(text, render) {
                return render($(adres).find(text).text());
            };
        }
    });
    html += Mustache.render(template, { label: "Adres", value: v });

    html += Mustache.render(template, { label: "Postcode", value: $(adres).find("Postcode").text() });
    html += Mustache.render(template, { label: "Woonplaats", value: $(adres).find("Woonplaats").text() });

    html += Mustache.render(template, { separator: true, label: "Prioriteit", value: $(incident).find("Prioriteit").text() });


    html += Mustache.render(template, { label: "Melding classificatie", value: $(incident).find("Classificatie").text() });

    var karakteristiek = $(incident).find("Karakteristiek");

    if(karakteristiek.length === 0) {
        html += '<tr><td>Karakteristieken:</td><td>';
        html += "<h4>-</h4>";
    } else {
        html += '<tr><td colspan="2">Karakteristieken:<br/>';
        html += '<div class="table-responsive" style="margin: 0px 10px 0px 10px">';
        html += '<table class="table table-hover" style="width: auto">';
        $.each(karakteristiek, function(i, k) {
            v = {};
            v.naam = $(k).find("KarakteristiekNaam").text();
            v.waarde = $(k).find("KarakteristiekWaarde").text();

            html += Mustache.render("<tr><td>{{naam}}</td><td>{{waarde}}</td></tr>", v);
        });
        html += '</table><div/>';
    }
    html += '</td></tr>';

    if(showInzet) {
        html += '<tr><td colspan="2" id="eenheden">';
        var eenhBrw = "", eenhPol = "", eenhAmbu = "";
        $.each($(incident).find("GekoppeldeEenheden Eenheid"), function(i, eenheid) {
            var naam = $(eenheid).find("Roepnaam").text();
            var disc = $(eenheid).find("Disc").text();

            var span = "<span>" + dbkjs.util.htmlEncode(naam) + "</span><br/>";
            if("B--" === disc) {
                eenhBrw += span;
            } else if("--P" === disc) {
                eenhPol += span;
            } else if("-A-" === disc) {
                eenhAmbu += span;
            }
        });
        html += '<div id="brw"><b>Brandweer</b><br/>' + eenhBrw + '</div>';
        html += '<div id="pol"><b>Politie</b><br/>' + eenhPol + '</div>';
        html += '<div id="ambu"><b>Ambu</b><br/>' + eenhAmbu + '</div>';
        html += '</td></tr>';
    }

    var afspraak = $(incident).find("AfspraakOpLocatie").text();
    if(afspraak) {
        html += Mustache.render("<tr><td>Afspraak op locatie:</td><td>{{v}}</td></tr>", {v: afspraak});
    }

    var kladblok = $(incident).find("Kladblok");

    if(kladblok.length !== 0) {
        html += '<tr><td id="kladblok" colspan="2">';
        var pre = "";
        $.each(kladblok, function(i, k) {
            pre += "<span class='brw'>" + dbkjs.util.htmlEncode($(k).text()) + "\n</span>";
        });
        html += "Kladblok:<br/>" + pre + "</pre>";
        html += '</td></tr>';
    }

    html += '</table>';

    return html;
};
