/*
 *  Copyright (c) 2015-2018 B3Partners (info@b3partners.nl)
 *
 *  This file is part of safetymaps-viewer.
 *
 *  safetymaps-viewer is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  safetymaps-viewer is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with safetymaps-viewer. If not, see <http://www.gnu.org/licenses/>.
 */

/* global dbkjs, safetymaps, OpenLayers, Proj4js, jsts, moment, i18n, Mustache, PDFObject */
/* global AGSIncidentService */


/**
 * Controller for displaying recent incidents, active and archived.
 */
function IncidentMonitorController(options) {
    var me = this;
    me.options = $.extend({
        apiPath: dbkjs.options.urls && dbkjs.options.urls.apiPath ? dbkjs.options.urls.apiPath : "api/",

        showVehicles: true,
        vehicleSource: "incidentService",
        vehicleSourceURL: null,
        logVehicles: false,
        showInzetRol: true,
        showTwitter: false,
        logTwitter: false,
        enableUnassignedVehicles: true,
        incidentListFunction: null,
        incidentListFooterFunction: null,
        updateInterval: 30000,
        updateIntervalError: 5000,
        updateTries: 3,
        incidentSource: "SafetyConnect",
        agsService: null,
        cacheArchivedIncidents: true,
    }, options);
    me.service = me.options.agsService;

    // Debug option to show incidents without units attached
    me.options.toonZonderEenheden = OpenLayers.Util.getParameters().toonZonderEenheden === "true" || me.options.includeIncidentsWithoutUnits;

    me.button = new AlertableButton("btn_incidentlist", "Incidentenlijst", "list");
    me.button.getElement().insertAfter('#btn_incident');
    $(me.button).on('click', function() {
        me.incidentListWindow.show();
    });

    me.incidentListWindow = new IncidentListWindow();
    me.incidentListWindow.createElements("Incidenten");
    $(me.incidentListWindow).on('show', function() {
        me.setAllIncidentsRead();
    });
    $(me.incidentListWindow).on('click', function(e, obj) {
        me.selectIncident(obj);
    });

    var selectLayers = [];

    if(me.options.showVehicles) {
        var showUnassignedButMoving = !!window.localStorage.getItem("showUnassignedButMoving");
        me.vehiclePositionLayer = new VehiclePositionLayer({
            showUnassignedButMoving: showUnassignedButMoving,
            showInzetRol: me.options.showInzetRol,
            vehiclePopupTemplate: me.options.vehiclePopupTemplate,
            vehiclesShowVehiclePopup: me.options.vehiclesShowVehiclePopup
        });
        if(me.options.enableUnassignedVehicles) {
            $("#settingspanel_b").append('<hr/><label><input id="im_showunassignedbutmoving" type="checkbox" ' + (showUnassignedButMoving ? 'checked' : '') + '>Toon bewegende voertuigen niet gekoppeld aan incident (grijs)</label>');
            $("#im_showunassignedbutmoving").on("click", function(event) {
                showUnassignedButMoving = event.target.checked;
                window.localStorage.setItem("showUnassignedButMoving", showUnassignedButMoving);
                me.vehiclePositionLayer.setShowUnassignedButMoving(showUnassignedButMoving);
            });
        }
        selectLayers.push(me.vehiclePositionLayer.layer);
    }

    me.markerLayer = new IncidentVectorLayer(true);
    selectLayers.push(me.markerLayer.layer);
    $(me.markerLayer).on('click', function(e, obj) {
        me.selectIncident(obj);
    });

    me.addSelectLayers(selectLayers);

    me.failedUpdateTries = 0;
    me.archivedIncidents = [];

    me.initIncidents();
};

IncidentMonitorController.prototype.initIncidents = function() {
    var me = this;
    me.getIncidentList();
    // Check if data outdated when returning from suspended execution
    me.updateInterval = window.setInterval(function() {
        me.checkIncidentListOutdated();
    }, 500);
};

IncidentMonitorController.prototype.enable = function() {
    me.incident = null;
    $("#btn_incidentlist").show();
    this.markerLayer.layer.setVisibility(true);
    this.initIncidents();
};

IncidentMonitorController.prototype.disable = function() {
    me.incident = null;
    window.clearInterval(this.updateInterval);
    window.clearTimeout(this.getIncidentListTimeout);
    $("#btn_incidentlist").hide();
    this.markerLayer.layer.setVisibility(false);
};

IncidentMonitorController.prototype.addSelectLayers = function(layers) {
    dbkjs.selectControl.deactivate();
    dbkjs.selectControl.setLayer(layers);
    dbkjs.selectControl.activate();
};

IncidentMonitorController.prototype.setAllIncidentsRead = function() {
    var me = this;
    me.button.setAlerted(false);
    me.readCurrentIncidentIds = me.currentIncidentIds ? me.currentIncidentIds : [];
};

IncidentMonitorController.prototype.checkUnreadIncidents = function(newCurrentIncidentIds) {
    var me = this;
    if(!me.currentIncidentIds) {
        // First incident list
        me.currentIncidentIds = newCurrentIncidentIds;
        me.readCurrentIncidents = [];

        if(me.currentIncidentIds.length > 0) {
            me.button.setAlerted(true);
        }
        console.log("IM: First incident list, ids: " + me.currentIncidentIds);
    } else {
        $.each(newCurrentIncidentIds, function(i, incidentId) {
            if(me.currentIncidentIds.indexOf(incidentId) === -1) {
                // New incident
                console.log("IM: New incident ", incidentId);
                me.button.setAlerted(true);
                return false;
            }
        });
        me.currentIncidentIds = newCurrentIncidentIds;
    }
};

IncidentMonitorController.prototype.incidentRead = function(incidentId) {
    var me = this;
    if(!me.readCurrentIncidentIds || me.readCurrentIncidentIds.indexOf(incidentId) === -1) {
        // Incident was not read before
        console.log("IM: Incident shown which was not shown before: " + incidentId);
        if(!me.readCurrentIncidentIds) {
            me.readCurrentIncidentIds = [incidentId];
        } else {
            me.readCurrentIncidentIds.push(incidentId);
        }

        // Check if all incidents are now read
        var allRead = true;
        $.each(me.currentIncidentIds || [], function(i, checkIncidentId) {
            if(me.readCurrentIncidentIds.indexOf(checkIncidentId) === -1) {
                allRead = false;
                return false;
            }
        });
        if(allRead) {
            console.log("IM: All incident ids read");
            me.button.setAlerted(false);
        }
    }
};

/**
 * Get incident info from safetyconnect/incident/[me.incident.IncidentNummer]
 */
IncidentMonitorController.prototype.getSafetyConnectIncident = function (fromIncidentList) {
    var me = this;
    var maxPrio = me.options.includePrio4And5Incidents ? 5 : 3;
    // Get incident
    $.ajax(me.options.apiPath + "safetyconnect/incident/" + me.incident.IncidentNummer, {
        dataType: "json",
        data: {
            extended: true,
            excludeTraining: me.options.excludeManuallyCreatedIncidents,
            daysInPast: me.options.getIncidentsFromDaysInPast,
            prio: maxPrio,
            includeWithoutUnits: me.options.includeIncidentsWithoutUnits,
        },
        xhrFields: { withCredentials: true }, crossDomain: true
    })
    .fail(function(e) {
        console.log("IM SC: Error getting incident data", arguments);
        me.incidentTimerFails = me.incidentTimerFails + 1;
    })
    .done(function(data) {
        me.incidentTimerFails = 0;
        if(data.length === 0 || !data[0].IncidentId) {
            console.log("IM SC: Error getting incident data (empty result)", arguments);
            $(me).triggerHandler("incident_empty");
            return;
        }
        try {
            var incidentInfo = { source: me.options.incidentSource, incident: data[0]};
            VehicleIncidentsController.prototype.normalizeIncidentFields(incidentInfo);
            $(me).triggerHandler("incident_selected", [incidentInfo, fromIncidentList]);
        } catch(e) {
            console.log("IM SC: Error processing incident", e, data);
        }
    });
}

/**
 * Get incident info from VrhAGS service
 */
IncidentMonitorController.prototype.getVrhAGSIncident = function (fromIncidentList) {
    var me = this;
    // Get incident
    me.service.getAllIncidentInfo(me.incidentId, me.incident.archief, false)
    .fail(function(e) {
        console.log("IM VrhAGS: Error getting incident data", arguments);
        me.incidentTimerFails = me.incidentTimerFails + 1;
    })
    .done(function(incident) {
        me.incidentTimerFails = 0;
        if(!incident || !incident.NR_INCIDENT) {
            console.log("IM VrhAGS: invalid incident", incident);
            return;
        }
        var incidentInfo = { source: me.options.incidentSource, incidenten: [incident.NR_INCIDENT], incident: incident};
        VehicleIncidentsController.prototype.normalizeIncidentFields(incidentInfo);
        $(me).triggerHandler("incident_selected", [incidentInfo, fromIncidentList]);
    });
}

/**
 * Try get incident from me.options.incidentSource
 */
IncidentMonitorController.prototype.tryGetIncident = function (fromIncidentList) {
    var me = this;
    // Check params for null values
    if (typeof fromIncidentList === "undefined") {
        fromIncidentList = false;
    }
    // Only when there is no open incident
    if (!me.incident) {
        return;
    }
    // Try get
    if(me.options.incidentSource === "SafetyConnect") {
        me.getSafetyConnectIncident(fromIncidentList);
    } else if(me.options.incidentSource === "VrhAGS") {
        me.getVrhAGSIncident(fromIncidentList);
    } else {
        throw new Error("Invalid incident source");
    }
}

IncidentMonitorController.prototype.selectIncident = function(obj) {
    var me = this;

    if(me.selectedIncidentMarker) {
        me.markerLayer.removeMarker(me.selectedIncidentMarker);
    }
    me.incident = obj.incident;
    me.incidentId = me.incident.INCIDENT_ID || me.incident.IncidentNummer;
    console.log("IM: Select incident " + me.incidentId + ", addMarker=" + obj.addMarker);
    if(obj.addMarker && me.markerLayer) {
        me.selectedIncidentMarker = me.markerLayer.addIncident(me.incident, true);
    }

    me.incidentRead(me.incidentId);
    me.tryGetIncident(true);
};

IncidentMonitorController.prototype.checkIncidentListOutdated = function() {
    var me = this;
    var lastUpdate = new Date().getTime() - me.lastGetIncidentList;
    if(lastUpdate > me.options.updateInterval + 5000) {
        console.log("IM: incident list outdated, last updated " + (lastUpdate/1000.0) + "s ago, updating now");
        me.getIncidentList();
    }
};

IncidentMonitorController.prototype.getIncidentList = function() {
    var me = this;

    window.clearTimeout(me.getIncidentListTimeout);
    me.lastGetIncidentList = new Date().getTime();

    if(me.options.incidentSource === "SafetyConnect") {
        me.getIncidentListSC();
    } else if(me.options.incidentSource === "VrhAGS") {
        me.service.whenInitialized().done(function() {
            me.getIncidentListVrhAGS();
        });
    }
};

IncidentMonitorController.prototype.getIncidentListVrhAGS = function() {
    var me = this;

    var dCurrent = me.service.getCurrentIncidents();
    var dArchived = me.service.getArchivedIncidents(me.options.cacheArchivedIncidents ? me.archivedIncidents : null);

    $.when(dCurrent, dArchived)
    .fail(function(e) {
        me.failedUpdateTries = me.failedUpdateTries + 1;
        var triesExceeded = me.failedUpdateTries > me.options.updateTries;

        // Stop hammering service that is failing after tries exceeding, retry
        // after normal update time

        window.clearTimeout(me.getIncidentListTimeout);
        me.getIncidentListTimeout = window.setTimeout(function() {
            me.getIncidentList();
        }, triesExceeded ? me.options.updateInterval : me.options.updateIntervalError);

        console.log("IM VrhAGS: Error getting incident list, try: " + me.failedUpdateTries + ", error: " + e);

        // Only show error after number of failed tries
        if(triesExceeded) {
            var msg = "Kan incidentenlijst niet ophalen na " + me.failedUpdateTries + " pogingen: " + e;
            dbkjs.util.showError(msg);
            me.incidentListWindow.showError(msg);
        }
    })
    .done(function(currentIncidents, archivedIncidents) {
        window.clearTimeout(me.getIncidentListTimeout);
        me.getIncidentListTimeout = window.setTimeout(function() {
            me.getIncidentList();
        }, me.options.updateInterval);

        me.failedUpdateTries = 0;
        $('#systeem_meldingen').hide(); // XXX
        $.each(currentIncidents.concat(archivedIncidents), function(i, incident) {
            VehicleIncidentsController.prototype.normalizeIncidentFields({
                source: "VrhAGS",
                incident: incident
            });
        });
        me.processNewArchivedIncidents(archivedIncidents);
        me.currentIncidents = currentIncidents;
        me.updateInterface();
        me.checkUnreadIncidents(me.actueleIncidentIds);
    });
};

IncidentMonitorController.prototype.getIncidentListSC = function() {
    var me = this;
    var maxPrio = me.options.includePrio4And5Incidents ? 5 : 3;

    $.ajax(me.options.apiPath + "safetyconnect/incident", {
        dataType: "json",
        data: {
            extended: true,
            excludeTraining: me.options.excludeManuallyCreatedIncidents,
            daysInPast: me.options.getIncidentsFromDaysInPast,
            prio: maxPrio,
            includeWithoutUnits: me.options.includeIncidentsWithoutUnits,
        },
        cache: false,
        xhrFields: { withCredentials: true }, crossDomain: true
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        me.failedUpdateTries = me.failedUpdateTries + 1;
        var triesExceeded = me.failedUpdateTries > me.options.updateTries;

        // Stop hammering service that is failing after tries exceeding, retry
        // after normal update time
        window.clearTimeout(me.getIncidentListTimeout);
        me.getIncidentListTimeout = window.setTimeout(function() {
            me.getIncidentList();
        }, triesExceeded ? me.options.updateInterval : me.options.updateIntervalError);

        var e = AGSIncidentService.prototype.getAjaxError(jqXHR, textStatus, errorThrown);
        console.log("IM SC: Error getting incident list, try: " + me.failedUpdateTries + ", error: " + e);

        // Only show error after number of failed tries
        if(triesExceeded) {
            var msg = "Kan incidentenlijst niet ophalen na " + me.failedUpdateTries + " pogingen: " + e;
            dbkjs.util.showError(msg);
            me.incidentListWindow.showError(msg);
        }
    })
    .done(function(data) {
        window.clearTimeout(me.getIncidentListTimeout);
        me.getIncidentListTimeout = window.setTimeout(function() {
            me.getIncidentList();
        }, me.options.updateInterval);

        me.failedUpdateTries = 0;
        $('#systeem_meldingen').hide(); // XXX

        me.incidents = data;
        me.processSCIncidents();
        me.updateInterface();
        me.checkUnreadIncidents(me.actueleIncidentIds);
    });
};

IncidentMonitorController.prototype.processSCIncidents = function() {
    var me = this;

    me.currentIncidents = [];
    me.archivedIncidents = [];

    $.each(me.incidents, function(i, incident) {
        VehicleIncidentsController.prototype.normalizeIncidentFields({
            source: "SafetyConnect",
            incident: incident
        });

        if(incident.Actueel) {
            me.currentIncidents.push(incident);
        } else {
            // Zorg dat niet direct 'endIncident' wordt afgevuurd bij bekijken niet-actueel incident
            incident.archief = true;
            me.archivedIncidents.push(incident);
        }
    });
};

IncidentMonitorController.prototype.updateInterface = function() {
    var me = this;
    if(!me.currentIncidents) {
        return;
    }

    function incidentFilter(incident) {
        return me.options.toonZonderEenheden || (incident.actueleInzet || incident.beeindigdeInzet || incident.inzetEenhedenStats.B.total !== 0);
    }

    // Filter current and archived with criteria for both
    var archivedFiltered = $.grep(me.archivedIncidents, incidentFilter);

    var currentFiltered = $.grep(me.currentIncidents, incidentFilter);

    // Active incident: current and actueleInzet
    // Inactive incident: (current and !actueleInzet) or archived
    var active = [];
    var inactive = [];
    $.each(currentFiltered, function(i, incident) {
        if(incident.actueleInzet) {
            active.push(incident);
        } else if(incident.beeindigdeInzet || me.options.toonZonderEenheden) {
            inactive.push(incident);
        }
    });

    // XXX
    if(me.options.incidentSource === "VrhAGS") {
        // Voeg gearchiveerde incidenten toe aan inactive indien niet al vanuit
        // current incidents met beeindigde inzet
        $.each(archivedFiltered, function(i, incident) {
            var duplicate = false;
            $.each(inactive, function(j, iIncident) {
                if(iIncident.INCIDENT_ID === incident.INCIDENT_ID) {
                    duplicate = true;
                    return false;
                }
            });
            if(!duplicate) {
                inactive.push(incident);
            }
        });
    } else if(me.options.incidentSource === "SafetyConnect") {
        inactive = inactive.concat(archivedFiltered);
        inactive.sort(function(lhs, rhs) {
            return rhs.start.valueOf() - lhs.start.valueOf();
        });
    } else {
        throw new Error("Invalid incident source");
    }

    me.actueleIncidentIds = $.map(active, function(incident) { return incident.INCIDENT_ID || incident.IncidentNummer; });

    // XXX
    if(me.options.incidentSource === "VrhAGS") {
        // Remove duplicate incidents
        inactive = $.grep(inactive, function(incident) {
            return me.actueleIncidentIds.indexOf(incident.INCIDENT_ID) === -1;
        });

        inactive.sort(function(lhs, rhs) {
            return rhs.DTG_START_INCIDENT - lhs.DTG_START_INCIDENT;
        });
    }

    me.incidentListWindow.data(active, inactive, true);
    me.updateMarkerLayer(active);
    me.updateVehiclePositionLayer(active);
};

IncidentMonitorController.prototype.processNewArchivedIncidents = function(archivedIncidents) {
    var me = this;

    if(!me.options.cacheArchivedIncidents) {
        me.archivedIncidents = archivedIncidents;
        return;
    }

    console.log("IM: Huidig aantal gearchiveerde incidenten: " + me.archivedIncidents.length + ", nieuw ontvangen: " + archivedIncidents.length);
    me.archivedIncidents = archivedIncidents.concat(me.archivedIncidents);

    // Remove old archived incidents (start incident more than 24 hours ago)
    var cutoff = new moment().subtract(24, 'hours');
    me.archivedIncidents = $.grep(me.archivedIncidents, function(incident) {
        if(incident.start.isBefore(cutoff)) {
            console.log("IM: Verwijder oud incident begonnen op " + incident.start.format("D-M-YYYY HH:mm") + " voor 24u cutoff van " + cutoff.format("D-M-YYYY HH:mm"));
        }
        return !incident.start.isBefore(cutoff);
    });
};

IncidentMonitorController.prototype.updateMarkerLayer = function(incidents) {
    var me = this;
    if(!me.markerLayer) {
        return;
    }
    me.markerLayer.clear();
    $.each(incidents, function(i, incident) {
        if(incident.actueleInzet) {
            me.markerLayer.addIncident(incident, false);
        }
    });
    if(me.selectedIncidentMarker) {
        me.selectedIncidentMarker = me.markerLayer.addIncident(me.incident, true);
    }
    me.markerLayer.setZIndexFix();
};

IncidentMonitorController.prototype.updateVehiclePositionLayer = function(incidents) {
    var me = this;

    if(!me.options.showVehicles) {
        return;
    }

    if(me.options.incidentSource === "VrhAGS") {
        me.service.getVehiclePositions(incidents)
        .done(function(features) {
            me.vehiclePositionLayer.features(features);
        });
    } else if(me.options.incidentSource === "SafetyConnect") {
        $.ajax(me.options.apiPath + "safetyconnect/eenheidlocatie", {
            dataType: "json",
            data: {
                extended: false
            },
            xhrFields: { withCredentials: true }, crossDomain: true
        })
        .done(function (data, textStatus, jqXHR) {
            me.options.logVehicles && console.log("IM SC: Vehicle positions", data);
            var transformedVehicles = data.features
                .filter(function(f) {
                    // XXX is filter for incidentNummer in incidents array (or speed > 5)
                    // needed?
                    return true;
                })
                .map(function(f) {
                    // Map SC vehicles schema to schema expected by VehiclePositionLayer
                    // (based on VrhAGS)
                    var props = f.properties;
                    var attributes = {
                        IncidentID: props.incidentNummer || "",
                        InzetRol: props.inzetRol,
                        Roepnummer: props.id,
                        Speed: me.options.showSpeed ? props.speed || 0 : 0,
                        Direction: props.heading
                        //PositionTimeFromNow: not available
                    };
                    var geometry = new OpenLayers.Geometry.Point(f.geometry.coordinates[0], f.geometry.coordinates[1]);
                    return new OpenLayers.Feature.Vector(geometry, attributes);
                });
            me.options.logVehicles && console.log("IM SC: Transformed vehicle positions for layer", transformedVehicles);
            me.vehiclePositionLayer.features(transformedVehicles);
        });
    }
};

IncidentMonitorController.prototype.loadTweets = function(incident) {
    var me = this;

    if(typeof window.twttr === 'undefined') {
        window.twttr = (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0],
                t = window.twttr || {};
            if (d.getElementById(id)) return t;
            js = d.createElement(s);
            js.id = id;
            js.src = "https://platform.twitter.com/widgets.js";
            fjs.parentNode.insertBefore(js, fjs);
            t._e = [];
            t.ready = function(f) {
                t._e.push(f);
            };
            return t;
        }(document, "script", "twitter-wjs"));
        twttr.ready(function(twttr) {
            me.loadTweets(incident);
        });
    }

    var pos = AGSIncidentService.prototype.getIncidentXY(incident);

    var p = new Proj4js.Point(pos.x, pos.y);
    var t = Proj4js.transform(new Proj4js.Proj(dbkjs.options.projection.code), new Proj4js.Proj("EPSG:4326"), p);

    me.options.logTwitter && console.log("Loading tweets for incident, geo=", t);

    $("#t_twitter_title").text("Twitter (...)");

    var terms = [];
    var address = '"' + incident.straat + '"';
    if(incident.woonplaats) {
        terms.push(incident.woonplaats === "'s-Gravenhage" ? "Den Haag" : incident.woonplaats);
    }
    if(incident.locatie2 && incident.straat !== incident.locatie2) {
        terms = terms.concat(incident.locatie2.split(" "));
    }

    if(incident.classificaties) {
        var classificaties = incident.classificaties.split(", ");
        $.each(classificaties, function(i, c) {
            var classificatieTerms = {
                "Alarm": true,
                "Brandgerucht": "brand brandweer rook",
                "Stormschade": "storm",
                "Onweer": true,
                "Windstoten": true,
                "Brand": "brand brandweer rook",
                "Heidebrand": true,
                "Liftopsluiting": "lift",
                "Vuurwerk": true,
                "Veenbrand": true,
                "Dier in problemen": true,
                "Bosbrand": true,
                "Nacontrole": true,
                "Nablussen": true,
                "Brandweer": true,
                "Wateroverlast": true,
                "Gladheid/Sneeuw": true,
                "Persoon te water": true,
                "Vervuild wegdek": true,
                "Rookmelder": true,
                "Duinbrand": true,
                "Stank": true,
                "Verontreiniging": true,
                "Ongeval": true,
                "Loslopende dieren": true,
                "Gladheid": true,
                "Voertuig te water": true,
                "Reanimatie": true
            };
            var v = classificatieTerms[c];
            if(typeof v !== "undefined") {
                if(typeof v === "string") {
                    terms = terms.concat(v.split(" "));
                } else {
                    terms.push(c);
                }
            }
        });
    }
    var karakteristieken = [];

    // XXX should be normalized field
    if(incident.karakteristiek) {
        $.each(incident.karakteristiek, function(i, k) {
            karakteristieken.push({ naam: k.NAAM_KARAKTERISTIEK, values: k.ACTUELE_KAR_WAARDE.split("/") });
        });
    }
    // XXX should be normalized field
    if(incident.Karakteristieken) {
        $.each(incident.Karakteristieken, function(i, k) {
            karakteristieken.push({ naam: k.Naam, values: k.Waarden });
        });
    }

    $.each(karakteristieken, function(i, k) {
        var karakteristiekenTerms = [
            "Soort dier",
            "Soort voertuig",
            "OMS oorzaak",
            "Soort bedrijf/Inst.",
            "Onderdeel gebouw",
            "Soort stormschade",
            "Soort ongeval",
            "Soort vaartuig",
            "Soort lucht",
            "Inzet brw",
            "Soort persoon.",
            "Soort brandstof"
        ];
        if(karakteristiekenTerms.indexOf(k.naam) !== -1) {
            terms = terms.concat(k.values);
        }
        if(k.naam === "GRIP") {
            terms.push("GRIP");
        }
    });

    function checkSoort(soort) {
        if(soort && soort.indexOf("MMT") !== -1) {
            terms.push("MMT");
            terms.push("heli");
            return false;
        }
    }
    if(incident.inzetEenheden) {
        $.each(incident.inzetEenheden, function(i, e) {
            return checkSoort(e.ROL);
        });
    }
    if(incident.BetrokkenEenheden) {
        $.each(incident.BetrokkenEenheden, function(i, e) {
            return checkSoort(e.InzetRol);
        });
    }

    var params = {
        incidentId: incident.id,
        location: t.y.toFixed(8) + "," + t.x.toFixed(8),
        startTime: incident.start.format("X"),
        terms: JSON.stringify(terms),
        address: address
    };
    // XXX should be normalized field
    if(incident.DTG_EINDE_INCIDENT) {
        params.endTime = AGSIncidentService.prototype.getAGSMoment(incident.DTG_EINDE_INCIDENT).format("X");
    }

    // Remove fixed height used for keeping previous scrollTop
    $("#tab_twitter").css("height", "");

    $.ajax((me.options.twitterUrlPrefix ? me.options.twitterUrlPrefix : "") + "api/twitter", {
        dataType: "json",
        data: params
    }).fail(function(jqXHR, textStatus, errorThrown) {
        $("#t_twitter_title").text("Twitter (!)");
        $("#tab_twitter").text(AGSIncidentService.prototype.getAjaxError(jqXHR, textStatus, errorThrown));
    }).done(function(data) {
        me.options.logTwitter && console.log("Twitter search response", data);

        // Fix height to scrollTop does not get reset when clearing div
        $("#tab_twitter").css("height", $("#tab_twitter").height());
        $("#tab_twitter").html("");

        if(!data.result) {
            $("#tab_twitter").html("Fout in server-component bij ophalen tweets");
        } else if(data.response.errors) {
            $("#tab_twitter").html(JSON.stringify(data.response.errors));
        } else {
            var statuses = data.response.statuses;

            var tweets = 0;

            var endCutoff = null;
            if(incident.DTG_EINDE_INCIDENT) {
                endCutoff = AGSIncidentService.prototype.getAGSMoment(incident.DTG_EINDE_INCIDENT);
            }
            if(incident.EindeDTG) {
                endCutoff = new moment(incident.EindeDTG);
            }

            var displayedTweets = [];
            var ignoredAccounts = me.options.twitterIgnoredAccounts || [];

            function filterTweet(status) {
                return ignoredAccounts.indexOf(status.user.screen_name) !== -1 || status.user.screen_name.toLowerCase().indexOf("p2000") !== -1;
            }

            function twitterMoment(date) {
                return new moment(date, "ddd MMM DD HH:mm:ss ZZ YYYY", "en");
            }

            $.each(statuses, function(i, status) {
                var createdAt = twitterMoment(status.created_at);
                if(createdAt.isAfter(incident.start) && (!endCutoff || createdAt.isBefore(endCutoff))) {
                    if(status.geo && displayedTweets.indexOf(status.text) === -1) {
                        if(!filterTweet(status)) {
                            displayedTweets.push(status.text);
                            var p2 = new Proj4js.Point(status.geo.coordinates[1], status.geo.coordinates[0]);
                            var t2 = Proj4js.transform(new Proj4js.Proj("EPSG:4326"), new Proj4js.Proj(dbkjs.options.projection.code), p2);
                            var distance = Math.sqrt(Math.pow(t2.x - pos.x, 2) + Math.pow(t2.y - pos.y, 2));
                            me.options.logTwitter && console.log("Tweet " + status.text + " at " + t2.x + "," + t2.y + ", distance " + distance + "m");
                            var el = $("<div id='tweet_" + status.id + "'>Afstand: " + Math.round(distance) + " meter</div>");
                            el.appendTo("#tab_twitter");
                            twttr.widgets.createTweet(status.id_str, document.getElementById("tweet_" + status.id),  { conversation: "none", width: 530, lang: "nl" } );
                            tweets++;
                        } else {
                            me.options.logTwitter && console.log("Filtering geo tweet user: " + status.user.screen_name, status);
                        }
                    }
                }
            });
            if(data.responseTerms && data.responseTerms.statuses.length > 0) {
                $("<div id='tweet_" + status.id + "'>Tweets tijdens incident op basis van zoektermen <i>" + address + ", " + terms.join(", ") + "</i></div>").appendTo("#tab_twitter");
                $.each(data.responseTerms.statuses, function(i, status) {
                    var createdAt = twitterMoment(status.created_at);
                    if(createdAt.isAfter(incident.start) /*&& (!endCutoff || createdAt.isBefore(endCutoff))*/) {
                        var text = status.retweeted_status ? status.retweeted_status.text : status.text;
                        if(displayedTweets.indexOf(text) === -1) {
                            if(!filterTweet(status) && (!status.retweeted_status || !filterTweet(status.retweeted_status))) {
                                displayedTweets.push(text);
                                me.options.logTwitter && console.log("Tweet matching terms: " + text, status);
                                twttr.widgets.createTweet(status.id_str, document.getElementById("tab_twitter"),  { conversation: "none", width: 530, lang: "nl" } );
                                tweets++;
                            } else {
                                me.options.logTwitter && console.log("Filtering search term tweet user: " + status.user.screen_name, status);
                            }
                        }
                    }
                });
            } else {
                $("<div id='tweet_" + status.id + "'>Geen tweets tijdens incident gevonden op basis van zoektermen <i>" + address + ", " + terms.join(", ") + "</i></div>").appendTo("#tab_twitter");
            }

            $("#t_twitter_title").text("Twitter (" + tweets + ")");

        }

    });
};
