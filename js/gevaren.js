/**
 * Objecten class, conform de DBK object definitie
 * 
 * Voor alle functionaliteit gerelateerd aan boringen
 */
var gevaren = {
    id: "dbkgev",
    /**
     * URL naar een statisch boringen bestand in gml formaat
     */
    url: "/geoserver/zeeland/wms?",
    namespace: "zeeland",
    /**
     * Laag. Wordt geiniteerd met de functie gevaren.show() kan worden overruled
     */
    layer: null,
    highlightlayer: null,
    updateFilter: function(dbk_id) {
        var cql_filter = "";
        if (typeof(dbk_id) !== "undefined") {
            cql_filter = "DBK_ID=" + dbk_id;
            this.layer.mergeNewParams({'CQL_FILTER': cql_filter});
        } else {
            delete this.layer.params.CQL_FILTER;
        }
        this.layer.redraw();
        return false;
    },
    show: function(activate) {
        this.layer = new OpenLayers.Layer.WMS("Onderkende gevaren en inzetbijzonderheden", this.url,
                {layers: this.namespace + ':WFS_tblGevaarlijk_Stoffen', format: 'image/png', transparent: true},
        {transitionEffect: 'none', singleTile: true, buffer: 0, isBaseLayer: false, visibility: true, attribution: "Falck", maxResolution: 6.71});
        if (activate === true) {
            map.addLayers([
                this.layer
            ]);
        }
        // vinkje op webpagina aan/uitzetten
        var dv_div = $('<li id="div_' + this.id + '" class="ovl"></li>');
        dv_div.append('<a href="#">' + this.layer.name + '</a>');
        $('#overlaypanel_b').append(dv_div);
        if (gevaren.layer.getVisibility()) {
            dv_div.addClass('active');
        }
        $('#div_' + this.id).click(function() {
            if ($(this).hasClass('active')) {
                gevaren.layer.setVisibility(false);
                $(this).removeClass('active');
            } else {
                gevaren.layer.setVisibility(true);
                $(this).addClass('active');
            }
        });
    },
    getfeatureinfo: function(e) {
        var params = {
            REQUEST: "GetFeatureInfo",
            EXCEPTIONS: "application/vnd.ogc.se_xml",
            BBOX: map.getExtent().toBBOX(),
            SERVICE: "WMS",
            INFO_FORMAT: 'application/vnd.ogc.gml',
            QUERY_LAYERS: gevaren.layer.params.LAYERS,
            FEATURE_COUNT: 50,
            Layers: gevaren.layer.params.LAYERS,
            WIDTH: map.size.w,
            HEIGHT: map.size.h,
            format: 'image/png',
            styles: gevaren.layer.params.STYLES,
            srs: gevaren.layer.params.SRS
        };

        // handle the wms 1.3 vs wms 1.1 madness
        if (preparatie.layer.params.VERSION === "1.3.0") {
            params.version = "1.3.0";
            params.j = e.xy.x;
            params.i = e.xy.y;
        } else {
            params.version = "1.1.1";
            params.x = e.xy.x;
            params.y = e.xy.y;
        }
        OpenLayers.Request.GET({url: gevaren.url, "params": params, callback: gevaren.panel});
        //OpenLayers.Event.stop(e);
    },
    panel: function(response) {
        //verwerk de featureinformatie
        g = new OpenLayers.Format.GML.v3();

        features = g.read(response.responseText);
        if (features.length > 0) {
            html = '<div class="infocontent">';
            for (var feat in features) {
                html += '<h2>Gevaarlijke stoffen</h2>';
                html += "<table>";
                for (var j in features[feat].attributes) {
                    if ($.inArray(j, ['Omschrijving', 'GEVIcode', 'UNnr', 'Hoeveelheid', 'NaamStof']) > -1) {
                        if (typeof(features[feat].attributes[j]) !== "undefined" && features[feat].attributes[j] !== "") {
                            html += '<tr><td><span class="infofieldtitle">' + j + "</span>: </td><td>" + features[feat].attributes[j] + "</td></tr>";
                        }
                    }
                }
                html += "</table>";
            }
            html += '</div>';
            $('#infopanel_b').append(html);
            $('#infopanel_f').html('');
            $('#infopanel').toggle(true);
        }
    }
};
modules.push(gevaren);
