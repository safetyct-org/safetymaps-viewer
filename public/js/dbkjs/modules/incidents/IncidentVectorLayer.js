/*
 *  Copyright (c) 2017 B3Partners (info@b3partners.nl)
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

function IncidentVectorLayer(enableLabels) {
    var me = this;
    me.enableLabels = enableLabels;

    me.ghor = dbkjs.modules.incidents.options.ghor;

    // Layer name starts with _ to hide in support module layer list
    me.layer = new OpenLayers.Layer.Vector("_Incident vectors", {
        rendererOptions: { zIndexing: true },
        styleMap: new OpenLayers.StyleMap({
            "default": new OpenLayers.Style({
                externalGraphic: "${icon}",
                graphicWidth: 24,
                graphicHeight: 26,
                label: "${label}",
                fontColor: "black",
                fontSize: "12px",
                fontWeight: "bold",
                labelYOffset: -20,
                labelOutlineColor: "yellow",
                labelOutlineWidth: 7,
                opacity: "${opacity}"
            }, {
                context: {
                    label: function(feature) {
                        return me.enableLabels && !me.hideLabel ? feature.attributes.label : "";
                    }
                }
            })
        })
    });
    me.layer.events.register("featureselected", me, me.featureSelected);
    dbkjs.map.addLayer(me.layer);

    if(me.enableLabels) {
        me.hideLabel =  window.localStorage.getItem("IncidentVectorLayer.hideLabel") === "true";
        $("#baselayerpanel_b").append('<hr/>');
        var l = $("<label/>");
        var input = $("<input type='checkbox' " + (me.hideLabel ? 'checked' : '') + ">");
        input.click(function(e) {
            me.setHideLabel(e.target.checked);
        });
        l.append(input);
        l.append("<span>Geen label tonen bij incidenten");
        $("#baselayerpanel_b").append(l);
    }

};

IncidentVectorLayer.prototype.setHideLabel = function(hideLabel) {
    this.hideLabel = hideLabel;
    this.layer.redraw();
    window.localStorage.setItem("IncidentVectorLayer.hideLabel", hideLabel);
};

IncidentVectorLayer.prototype.addIncident = function(incident, archief, singleMarker) {
    var me = this;
    var xy = AGSIncidentService.prototype.getIncidentXY(incident);
    var x = xy.x, y = xy.y;

    if(singleMarker) {
        if(x === me.x && y === me.y) {
            return;
        }

        this.layer.clearFeatures();

        me.x = x;
        me.y = y;
    }

    var icon;
    if(me.ghor) {
        var b = incident.inzetEenhedenStats.B.total;
        var a = incident.inzetEenhedenStats.A.total;
        if(archief) {
            icon = "images/bell-gray.png";
        } else if(b !== 0 && a !== 0) {
            icon = "images/bell-yellowred.png";
        } else if(a !== 0) {
            icon = "images/bell-yellow.png";
        } else {
            icon = "images/bell.png";
        }
    } else {
        icon = !archief ? "images/bell.png" : "images/bell-gray.png";
    }

    var classificatie = incident.classificaties;
    if(classificatie && classificatie.indexOf(",") !== -1) {
        classificatie = classificatie.split(",")[0];
    }
    var label = "P" + incident.PRIORITEIT_INCIDENT_BRANDWEER + " " + dbkjs.util.htmlEncode(classificatie) + " " + incident.locatie + " " + (incident.PLAATS_NAAM_NEN || incident.PLAATS_NAAM);
    var feature = new OpenLayers.Feature.Vector(
            new OpenLayers.Geometry.Point(x, y),
            {
                label: label,
                incident: incident,
                archief: archief,
                icon: icon,
                incident_id: incident.INCIDENT_ID,
                opacity: me.ghor && incident.inzetEenhedenStats.standard ? 0.5 : 0
            });

    this.layer.addFeatures(feature);

    return feature;
};

IncidentVectorLayer.prototype.setZIndexFix = function() {
//    this.layer.setZIndex(100000);
};

IncidentVectorLayer.prototype.removeMarker = function(marker) {
    this.layer.removeFeatures([marker]);
    marker.destroy();
};

IncidentVectorLayer.prototype.clear = function() {
    this.layer.destroyFeatures();
};

IncidentVectorLayer.prototype.featureSelected = function(e) {
    console.log("incident feature selected", e);
    dbkjs.selectControl.unselectAll();
    var a = e.feature.attributes;
    $(this).triggerHandler('click', { incident: a.incident, archief: a.archief});
};
